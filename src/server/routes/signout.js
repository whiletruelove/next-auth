import * as cookie from '../lib/cookie'
import logger from '../../lib/logger'
import dispatchEvent from '../lib/dispatch-event'

/** Handle requests to /api/auth/signout */
export default async function signout (req, res) {
  const { adapter, cookies, events, jwt, callbackUrl } = req.options
  const useJwtSession = req.options.session.jwt
  const sessionToken = req.cookies[cookies.sessionToken.name]

  if (useJwtSession) {
    // Dispatch signout event
    try {
      const decodedJwt = await jwt.decode({ ...jwt, token: sessionToken })
      await dispatchEvent(events.signOut, decodedJwt)
    } catch (error) {
      // Do nothing if decoding the JWT fails
    }
  } else {
    // Get session from database
    const { getSession, deleteSession } = await adapter.getAdapter(req.options)

    try {
      // Dispatch signout event
      const session = await getSession(sessionToken)
      await dispatchEvent(events.signOut, session)
    } catch (error) {
      // Do nothing if looking up the session fails
    }

    try {
      // Remove session from database
      await deleteSession(sessionToken)
    } catch (error) {
      // If error, log it but continue
      logger.error('SIGNOUT_ERROR', error)
    }
  }

  // Remove Session Token
  cookie.set(res, cookies.sessionToken.name, '', {
    ...cookies.sessionToken.options,
    maxAge: 0
  })

  return res.redirect(callbackUrl)
}
