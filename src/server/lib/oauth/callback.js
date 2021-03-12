import { decode as jwtDecode } from 'jsonwebtoken'
import { URL } from 'url'
import oAuthClient from './client'
import logger from '../../../lib/logger'
import { OAuthCallbackError } from '../../../lib/errors'

/** @param {import("../..").NextAuthRequest} req */
export default async function oAuthCallback (req) {
  const { provider, pkce } = req.options
  const client = oAuthClient(provider)

  if (provider.version?.startsWith('2.')) {
    // The "user" object is specific to the Apple provider and is provided on first sign in
    // e.g. {"name":{"firstName":"Johnny","lastName":"Appleseed"},"email":"johnny.appleseed@nextauth.com"}
    let { code, user } = req.query // eslint-disable-line camelcase

    if (req.method === 'POST') {
      try {
        const body = JSON.parse(JSON.stringify(req.body))
        if (body.error) {
          throw new Error(body.error)
        }

        code = body.code
        user = body.user != null ? JSON.parse(body.user) : null
      } catch (error) {
        logger.error('OAUTH_CALLBACK_HANDLER_ERROR', error, req.body, provider.id, code)
        throw error
      }
    }

    // REVIEW: Is this used by any of the providers?
    // Pass authToken in header by default (unless 'useAuthTokenHeader: false' is set)
    if (Object.prototype.hasOwnProperty.call(provider, 'useAuthTokenHeader')) {
      client.useAuthorizationHeaderforGET(provider.useAuthTokenHeader)
    } else {
      client.useAuthorizationHeaderforGET(true)
    }

    try {
      const tokens = await client.getOAuthAccessToken(code, provider, pkce.code_verifier)
      let profileData
      if (provider.idToken) {
        if (!tokens?.id_token) {
          throw new OAuthCallbackError('Missing JWT ID Token')
        }

        // Support services that use OpenID ID Tokens to encode profile data
        profileData = jwtDecode(tokens.id_token, { json: true })
      } else {
        // whiletrue.love: customize for wechat:oAuth2
        if (provider.id === 'wechat') {
          const urlObj = new URL(provider.profileUrl)
          urlObj.searchParams.append('access_token', tokens.accessToken)
          urlObj.searchParams.append('openid', tokens.openid)
          provider.profileUrl = urlObj.href
        }
        // whiletrue.love.
        profileData = await client.get(provider, tokens.accessToken, tokens)
      }

      return getProfile({ profileData, provider, tokens, user })
    } catch (error) {
      logger.error('OAUTH_GET_ACCESS_TOKEN_ERROR', error, provider.id, code)
      throw error
    }
  }

  try {
    // Handle OAuth v1.x
    const {
      oauth_token: oauthToken, oauth_verifier: oauthVerifier
    } = req.query
    const tokens = await client.getOAuthAccessToken(oauthToken, null, oauthVerifier)
    const profileData = await client.get(
      provider.profileUrl,
      tokens.accessToken,
      tokens.refreshToken
    )

    return getProfile({ profileData, tokens, provider })
  } catch (error) {
    logger.error('OAUTH_V1_GET_ACCESS_TOKEN_ERROR', error)
    throw error
  }
}

/**
 * //6/30/2020 @geraldnolan added userData parameter to attach additional data to the profileData object
 * Returns profile, raw profile and auth provider details
 * @param {{
 *   profileData: object | string
 *   tokens: {
 *     accessToken: string
 *     idToken?: string
 *     refreshToken?: string
 *     access_token: string
 *     expires_in?: string | Date | null
 *     refresh_token?: string
 *     id_token?: string
 *   }
 *   provider: import("../..").Provider
 *   user?: object
 * }} profileParams
 */
async function getProfile ({ profileData, tokens, provider, user }) {
  try {
    // Convert profileData into an object if it's a string
    if (typeof profileData === 'string' || profileData instanceof String) {
      profileData = JSON.parse(profileData)
    }

    // If a user object is supplied (e.g. Apple provider) add it to the profile object
    if (user != null) {
      profileData.user = user
    }

    logger.debug('PROFILE_DATA', profileData)

    const profile = await provider.profile(profileData, tokens)
    // Return profile, raw profile and auth provider details
    return {
      profile: {
        ...profile,
        email: profile.email?.toLowerCase() ?? null
      },
      account: {
        provider: provider.id,
        type: provider.type,
        id: profile.id,
        ...tokens
      },
      OAuthProfile: profileData
    }
  } catch (exception) {
    // If we didn't get a response either there was a problem with the provider
    // response *or* the user cancelled the action with the provider.
    //
    // Unfortuately, we can't tell which - at least not in a way that works for
    // all providers, so we return an empty object; the user should then be
    // redirected back to the sign up page. We log the error to help developers
    // who might be trying to debug this when configuring a new provider.
    logger.error('OAUTH_PARSE_PROFILE_ERROR', exception, profileData)
    return {
      profile: null,
      account: null,
      OAuthProfile: profileData
    }
  }
}
