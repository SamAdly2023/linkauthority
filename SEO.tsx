import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  name?: string;
  type?: string;
  image?: string;
  url?: string;
  canonical?: string;
}

const SEO: React.FC<SEOProps> = ({
  title = 'LinkAuthority - Premium Backlink Exchange Platform',
  description = 'Boost your website\'s Domain Authority and SEO rankings safely with LinkAuthority. The smartest way to build high-quality backlinks and grow your organic traffic.',
  name = 'LinkAuthority',
  type = 'website',
  image = 'https://www.linkauthority.live/link-authority-logo.png',
  url = 'https://www.linkauthority.live/',
  canonical
}) => {
  return (
    <Helmet>
      {/* Standard metadata tags */}
      <title>{title}</title>
      <meta name='description' content={description} />
      <meta name='image' content={image} />
      <link rel="canonical" href={canonical || url} />

      {/* Open Graph tags */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={name} />

      {/* Twitter tags */}
      <meta name="twitter:creator" content={name} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Structured Data (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "LinkAuthority",
          "applicationCategory": "SEO Software",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "description": description,
          "image": image,
          "url": url,
          "author": {
            "@type": "Person",
            "name": "Sam Adly"
          },
          "publisher": {
            "@type": "Organization",
            "name": "LinkAuthority",
            "logo": {
              "@type": "ImageObject",
              "url": image
            }
          }
        })}
      </script>
    </Helmet>
  );
}

export default SEO;
