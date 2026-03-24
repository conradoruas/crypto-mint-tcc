import Link from "next/link";

const Footer = () => {
  return (
    <footer className="w-full border-t border-outline-variant/15 mt-20 bg-background">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-12 py-16 w-full max-w-[1920px] mx-auto">
        <div>
          <span className="text-lg font-black text-on-surface font-headline uppercase tracking-tighter mb-4 block">
            CryptoMint
          </span>
          <p className="text-on-surface-variant text-sm max-w-sm mb-8 leading-relaxed">
            The premier destination for high-fidelity synthetic assets and
            digital artifacts. Engineered for the future of value.
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-on-surface-variant hover:text-secondary transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Twitter
            </a>
            <a
              href="#"
              className="text-on-surface-variant hover:text-secondary transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Discord
            </a>
            <a
              href="#"
              className="text-on-surface-variant hover:text-secondary transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Telegram
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h4 className="text-primary-container text-[10px] font-bold uppercase tracking-[0.3em] mb-6">
              Platform
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/explore"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider"
                >
                  Explore
                </Link>
              </li>
              <li>
                <Link
                  href="/collections"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider"
                >
                  Collections
                </Link>
              </li>
              <li>
                <Link
                  href="/mint"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider"
                >
                  Mint
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-primary-container text-[10px] font-bold uppercase tracking-[0.3em] mb-6">
              Security
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="#"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider"
                >
                  Audit
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-outline-variant/5 py-8 text-center">
        <p className="text-on-surface-variant text-[10px] uppercase tracking-[0.5em]">
          © 2026 CryptoMint. SYNTHETIC ASSETS RESERVED.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
