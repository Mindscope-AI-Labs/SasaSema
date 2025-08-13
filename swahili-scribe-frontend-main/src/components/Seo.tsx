import { useEffect } from "react";

interface SeoProps {
  title: string;
  description?: string;
  canonical?: string;
}

const ensureTag = (selector: string, create: () => HTMLElement) => {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el as HTMLElement;
};

export const Seo = ({ title, description, canonical }: SeoProps) => {
  useEffect(() => {
    document.title = title;

    if (description) {
      const metaDesc = ensureTag(
        'meta[name="description"]',
        () => Object.assign(document.createElement('meta'), { name: 'description' })
      ) as HTMLMetaElement;
      metaDesc.content = description;
    }

    const canonicalLink = ensureTag(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement('link'), { rel: 'canonical' })
    ) as HTMLLinkElement;
    if (canonical) {
      canonicalLink.href = canonical;
    } else {
      canonicalLink.href = window.location.href;
    }
  }, [title, description, canonical]);

  return null;
};

export default Seo;
