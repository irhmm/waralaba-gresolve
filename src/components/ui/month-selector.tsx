import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface MonthOption {
  value: string;
  label: string;
}

type TableName = 'admin_income' | 'worker_income' | 'expenses' | 'franchise_profit_sharing';

interface MonthSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  tables?: TableName[]; // Tables to check for data
  showSearch?: boolean;
  includeAll?: boolean;
}

export function MonthSelector({
  value,
  onValueChange,
  placeholder = "Pilih bulan...",
  label = "Pilih Bulan",
  tables = [],
  showSearch = true,
  includeAll = false
}: MonthSelectorProps) {
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [filteredMonths, setFilteredMonths] = useState<MonthOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tables.length > 0) {
      fetchAvailableMonths();
    } else {
      generateDefaultMonths();
    }
  }, [tables]);

  useEffect(() => {
    const filtered = availableMonths.filter(month =>
      month.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      month.value.includes(searchTerm)
    );
    setFilteredMonths(filtered);
  }, [availableMonths, searchTerm]);

  const generateDefaultMonths = () => {
    const months: MonthOption[] = [];
    const currentDate = new Date();
    
    if (includeAll) {
      months.push({ value: 'all', label: 'Semua Bulan' });
    }
    
    // Generate months from 2 years ago to 1 year ahead
    for (let i = -24; i <= 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy');
      months.push({ value, label });
    }
    
    setAvailableMonths(months);
  };

  const fetchAvailableMonths = async () => {
    setLoading(true);
    try {
      const monthsSet = new Set<string>();
      
      // Fetch distinct months from each table
      for (const table of tables) {
        if (table === 'franchise_profit_sharing') {
          // For franchise_profit_sharing table, month_year is already in YYYY-MM format
          const { data, error } = await supabase
            .from('franchise_profit_sharing')
            .select('month_year')
            .not('month_year', 'is', null);
          
          if (!error && data) {
            data.forEach((item: any) => {
              if (item.month_year) {
                monthsSet.add(item.month_year);
              }
            });
          }
        } else {
          // For other tables, extract month from timestamp
          let query;
          const column = 'tanggal';
          
          switch (table) {
            case 'admin_income':
              query = supabase.from('admin_income').select('tanggal').not('tanggal', 'is', null);
              break;
            case 'worker_income':
              query = supabase.from('worker_income').select('tanggal').not('tanggal', 'is', null);
              break;
            case 'expenses':
              query = supabase.from('expenses').select('tanggal').not('tanggal', 'is', null);
              break;
            default:
              continue;
          }
          
          const { data, error } = await query;
          
          if (!error && data) {
            data.forEach((item: any) => {
              if (item.tanggal) {
                const date = new Date(item.tanggal);
                const monthYear = format(date, 'yyyy-MM');
                monthsSet.add(monthYear);
              }
            });
          }
        }
      }
      
      // Convert to array and sort
      const monthsArray = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
      
      const months: MonthOption[] = [];
      
      if (includeAll) {
        months.push({ value: 'all', label: 'Semua Bulan' });
      }
      
      monthsArray.forEach(monthYear => {
        try {
          const [year, month] = monthYear.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          const label = format(date, 'MMMM yyyy');
          months.push({ value: monthYear, label });
        } catch (error) {
          console.error('Error parsing month:', monthYear, error);
        }
      });
      
      setAvailableMonths(months);
    } catch (error) {
      console.error('Error fetching available months:', error);
      generateDefaultMonths();
    } finally {
      setLoading(false);
    }
  };

  const selectedMonth = availableMonths.find(month => month.value === value);

  if (showSearch && availableMonths.length > 10) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              className="w-full justify-between"
              disabled={loading}
            >
              {selectedMonth ? selectedMonth.label : placeholder}
              <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0 bg-popover z-50" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari bulan atau tahun..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-auto bg-popover">
              {filteredMonths.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">
                  {loading ? 'Memuat...' : 'Tidak ada data ditemukan'}
                </div>
              ) : (
                filteredMonths.map((month) => (
                  <div
                    key={month.value}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    onClick={() => {
                      onValueChange(month.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    {month.label}
                    {value === month.value && (
                      <span className="absolute right-2 h-3.5 w-3.5">✓</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onValueChange} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Memuat..." : placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {availableMonths.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}