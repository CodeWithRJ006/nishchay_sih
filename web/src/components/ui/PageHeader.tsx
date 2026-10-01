
export const PageHeader = ({ title, description }: { title: string, description: string }) => {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-heading font-bold text-ink mb-1">{title}</h1>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
};
