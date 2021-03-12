import * as cookie from '../lib/cookie'

export default (req, res) => {
  const { query, body } = req
  const { cookies, defaultLocale } = req.options

  let locale = defaultLocale

  const localeParamValue = body.locale || query.locale || null
  const localeCookieValue = req.cookies[cookies.locale.name] || null

  if (localeParamValue) {
    locale = localeParamValue
  } else if (localeCookieValue) {
    locale = localeCookieValue
  }

  if (locale && (locale !== localeCookieValue)) { cookie.set(res, cookies.locale.name, locale, cookies.locale.options) }

  req.options.locale = locale
}
