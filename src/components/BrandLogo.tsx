type Props = {
  onClick?: () => void;
  href?: string;
  inverse?: boolean;
  className?: string;
};

export default function BrandLogo({ onClick, href, inverse = false, className = "" }: Props) {
  const content = <>
    <span className="brand-mark grid h-10 w-10 place-items-center rounded-[14px] text-lg font-black">П</span>
    <span className="brand-copy"><span className="block text-xl font-black leading-5 tracking-[-.055em]">пойдём</span><span className="brand-tagline mt-0.5 block text-[9px] font-bold uppercase tracking-[.16em]">люди · события · город</span></span>
  </>;
  const classes = `brand-lockup ${inverse ? "brand-lockup--inverse" : ""} flex items-center gap-2.5 ${className}`;

  if (href) return <a href={href} className={classes} aria-label="Пойдём — на главную">{content}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={classes} aria-label="Пойдём — на главную">{content}</button>;
  return <div className={classes} aria-label="Пойдём">{content}</div>;
}
