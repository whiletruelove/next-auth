import cookie from '../lib/cookie'

export default (req, res) => {
  const { body } = req
  const { cookies } = req.options
  const { bizAction } = body

  if (bizAction) {
    cookie.set(res, cookies.bizAction.name, bizAction, cookies.bizAction.options)
  }
}
