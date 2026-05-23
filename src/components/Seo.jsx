/**
 * Per-page SEO meta tags + canonical URL via react-helmet-async.
 *
 *   <Seo
 *     title="How FDMS works"
 *     description="..."
 *     path="/how-it-works"
 *   />
 *
 * Title is suffixed with " · zimFDMS" automatically unless `bareTitle` is set.
 */
import { Helmet } from 'react-helmet-async'

const SITE_URL  = 'https://zimrafdms.netlify.app'
const SITE_NAME = 'zimFDMS'
const DEFAULT_OG = `${SITE_URL}/og-image.svg`

export default function Seo({
  title,
  description,
  path = '',
  image = DEFAULT_OG,
  bareTitle = false,
  noindex = false,
}) {
  const fullTitle = bareTitle ? title : (title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — ZIMRA fiscalisation, without the headache`)
  const url = `${SITE_URL}${path}`

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />
    </Helmet>
  )
}
