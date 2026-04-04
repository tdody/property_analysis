import { useState, useRef, useEffect } from "react";

interface TooltipIconProps {
  text: string;
}

export function TooltipIcon({ text }: TooltipIconProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [show]);

  return (
    <span className="relative inline-block ml-1" ref={ref}>
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 text-xs"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        &#9432;
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
          {text}
        </div>
      )}
    </span>
  );
}
