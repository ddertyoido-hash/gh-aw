import { footerLinks, site } from '../data/content'

/** One clean line of real destinations under a hairline. */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <p className="footer__brand">
          <span className="footer__mark">{site.shortName}</span>
          <span>{site.name}</span>
        </p>

        <nav className="footer__links" aria-label="Project links">
          {footerLinks.map((item) => (
            <a key={item.href} href={item.href} target="_blank" rel="noreferrer noopener">
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
