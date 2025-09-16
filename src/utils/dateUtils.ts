import { format } from 'date-fns';

export const groupDataByMonth = (data: any[], dateField: string = 'tanggal') => {
  const grouped = data.reduce((acc, item) => {
    const date = new Date(item[dateField]);
    const monthYear = format(date, 'yyyy-MM');
    const monthLabel = format(date, 'MMMM yyyy');
    
    if (!acc[monthYear]) {
      acc[monthYear] = {
        label: monthLabel,
        items: [],
        total: 0
      };
    }
    
    acc[monthYear].items.push(item);
    
    return acc;
  }, {} as Record<string, { label: string; items: any[]; total: number }>);

  return grouped;
};

export const calculateMonthlyTotals = (groupedData: Record<string, { label: string; items: any[]; total: number }>, amountField: string = 'nominal') => {
  Object.keys(groupedData).forEach(month => {
    groupedData[month].total = groupedData[month].items.reduce((sum, item) => sum + (item[amountField] || 0), 0);
  });
  
  return groupedData;
};

export const getAvailableMonths = (data: any[], dateField: string = 'tanggal') => {
  const months = data.map(item => {
    const date = new Date(item[dateField]);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy')
    };
  });

  // Remove duplicates and sort
  const uniqueMonths = months.filter((month, index, self) => 
    index === self.findIndex(m => m.value === month.value)
  );

  return uniqueMonths.sort((a, b) => b.value.localeCompare(a.value));
};