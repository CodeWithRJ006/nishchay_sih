import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  description: string;
  backTo?: string | { to: string; label?: string };
}

export const PageHeader = ({ title, description, backTo }: PageHeaderProps) => {
  const target = typeof backTo === 'string' ? { to: backTo, label: 'Back' } : backTo;

  return (
    <div className="mb-6">
      {target && (
        <Link 
          to={target.to} 
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-calibration-blue hover:underline mb-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{target.label || 'Back'}</span>
        </Link>
      )}
      <h1 className="text-2xl font-heading font-bold text-ink mb-1">{title}</h1>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
};
