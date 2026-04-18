import Link from "next/link";

const Footer = () => {
  return (
    <footer className="w-full border-t border-outline-variant/15 mt-20 bg-background">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-16 py-12 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-10">
          {/* Brand */}
          <div className="max-w-xs">
            <span className="text-lg font-black text-on-surface font-headline uppercase tracking-tighter mb-3 block">
              CryptoMint
            </span>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              The premier destination for high-fidelity synthetic assets and
              digital artifacts. Engineered for the future of value.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-primary-container text-[10px] font-bold uppercase tracking-[0.3em] mb-5">
              Platform
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/explore"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider transition-colors"
                >
                  Explore
                </Link>
              </li>
              <li>
                <Link
                  href="/collections"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider transition-colors"
                >
                  Collections
                </Link>
              </li>
              <li>
                <Link
                  href="/mint"
                  className="text-on-surface-variant hover:text-secondary text-sm uppercase tracking-wider transition-colors"
                >
                  Mint
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-outline-variant/5 py-6 text-center px-6">
        <p className="text-on-surface-variant text-[10px] uppercase tracking-[0.5em]">
          © 2026 CryptoMint. Synthetic Assets Reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
