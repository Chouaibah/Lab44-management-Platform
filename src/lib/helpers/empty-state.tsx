import { Card, CardContent } from '@/components/ui/card';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center relative overflow-hidden">
        {/* Decorative concentric circles */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="w-48 h-48 rounded-full border border-dashed border-muted-foreground/5" />
          <div className="absolute w-32 h-32 rounded-full border border-dashed border-muted-foreground/[0.07]" />
          <div className="absolute w-16 h-16 rounded-full border border-dotted border-muted-foreground/[0.09]" />
        </div>
        {/* Dots pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          aria-hidden="true"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
        {/* Floating icon */}
        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-muted-foreground/5 animate-ping" style={{ animationDuration: '3s' }} />
          </div>
          <div className="animate-bounce" style={{ animationDuration: '3s' }}>
            <Icon className="h-12 w-12 text-muted-foreground/40 relative" />
          </div>
        </div>
        <h3 className="font-semibold mb-1 text-primary">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}