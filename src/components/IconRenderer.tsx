import * as Lucide from "lucide-react";

interface IconRendererProps {
  name: string;
  className?: string;
}

export default function IconRenderer({ name, className = "w-5 h-5" }: IconRendererProps) {
  const IconComponent = (Lucide as any)[name] || Lucide.HelpCircle;
  return <IconComponent className={className} />;
}
