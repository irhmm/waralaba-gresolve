import React from "react";
import { Table } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  minWidth?: string;
}

export function ResponsiveTable({ 
  children, 
  className, 
  minWidth = "800px",
  ...props 
}: ResponsiveTableProps) {
  return (
    <div 
      className={cn("overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6", className)}
      {...props}
    >
      <div className="px-3 sm:px-4 md:px-6">
        <div className="overflow-x-auto">
          <div style={{ minWidth }}>
            <Table>
              {children}
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MobileCardProps {
  data: Record<string, any>;
  fields: Array<{
    key: string;
    label: string;
    render?: (value: any) => React.ReactNode;
  }>;
  actions?: React.ReactNode;
  className?: string;
}

export function MobileCard({ data, fields, actions, className }: MobileCardProps) {
  return (
    <div className={cn("border border-border rounded-lg p-4 space-y-3 bg-background", className)}>
      {fields.map((field) => (
        <div key={field.key} className="flex justify-between items-start">
          <span className="text-sm font-medium text-muted-foreground min-w-0 flex-shrink-0 mr-2">
            {field.label}:
          </span>
          <span className="text-sm text-right min-w-0 flex-1 break-words">
            {field.render ? field.render(data[field.key]) : data[field.key]}
          </span>
        </div>
      ))}
      {actions && (
        <div className="flex justify-end pt-2 border-t border-border">
          {actions}
        </div>
      )}
    </div>
  );
}

interface ResponsiveTableWrapperProps {
  data: any[];
  renderDesktop: () => React.ReactNode;
  renderMobile: (item: any, index: number) => React.ReactNode;
  breakpoint?: number;
}

export function ResponsiveTableWrapper({ 
  data, 
  renderDesktop, 
  renderMobile, 
  breakpoint = 768 
}: ResponsiveTableWrapperProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, [breakpoint]);

  if (isMobile) {
    return (
      <div className="space-y-3">
        {data.map((item, index) => renderMobile(item, index))}
      </div>
    );
  }

  return renderDesktop();
}