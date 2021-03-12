import * as cookie from '../lib/cookie'

export default async (req, res) => {
  const { query, body } = req
  const { baseUrl, callbacks, cookies, locale } = req.options

  let errorCallbackUrl = null

  const errorCallbackUrlUrlParamValue = body.errorCallbackUrl || query.errorCallbackUrl || null
  const errorCallbackUrlUrlCookieValue = req.cookies[cookies.errorCallbackUrl.name] || null

  if (errorCallbackUrlUrlParamValue) {
    errorCallbackUrl = await callbacks.redirect(errorCallbackUrlUrlParamValue, baseUrl, locale)
  } else if (errorCallbackUrlUrlCookieValue) {
    errorCallbackUrl = await callbacks.redirect(errorCallbackUrlUrlCookieValue, baseUrl, locale)
  }

  if (errorCallbackUrl && (errorCallbackUrl !== errorCallbackUrlUrlCookieValue)) { cookie.set(res, cookies.errorCallbackUrl.name, errorCallbackUrl, cookies.errorCallbackUrl.options) }

  req.options.errorCallbackUrl = errorCallbackUrl
}
