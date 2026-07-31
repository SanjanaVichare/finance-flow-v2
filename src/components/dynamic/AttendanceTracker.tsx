// src/components/dynamic/AttendanceTracker.tsx
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isToday } from 'date-fns';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { CalendarIcon, Download, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Simplified status options
const STATUS_OPTIONS = [
    { value: 'present', label: '✅ Present', color: 'bg-green-500', icon: '✅' },
    { value: 'absent', label: '❌ Absent', color: 'bg-red-500', icon: '❌' },
    { value: 'late', label: '🕐 Late', color: 'bg-yellow-500', icon: '🕐' },
    { value: 'leave', label: '📝 Leave', color: 'bg-blue-500', icon: '📝' },
];

// Quick action buttons for common statuses
const QUICK_STATUSES = [
    { value: 'present', label: '✅', color: 'bg-green-500 hover:bg-green-600' },
    { value: 'absent', label: '❌', color: 'bg-red-500 hover:bg-red-600' },
    { value: 'late', label: '🕐', color: 'bg-yellow-500 hover:bg-yellow-600' },
    { value: 'leave', label: '📝', color: 'bg-blue-500 hover:bg-blue-600' },
];

interface AttendanceTrackerProps {
    entityDefinitionId: string;
    entityName: string;
}

export function AttendanceTracker({ entityDefinitionId, entityName }: AttendanceTrackerProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [quickStatus, setQuickStatus] = useState<string>('present');
    const [showBulkDialog, setShowBulkDialog] = useState(false);
    const [bulkStatus, setBulkStatus] = useState<string>('present');
    const [notes, setNotes] = useState('');
    const queryClient = useQueryClient();

    // Get company ID helper
    const getCompanyId = async (): Promise<string> => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Not authenticated');

        const { data: memberData, error } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('user_id', userData.user.id)
            .single();

        if (error || !memberData) {
            throw new Error('No company found');
        }
        return memberData.company_id;
    };

    // Fetch entities
    const { data: entities, isLoading: entitiesLoading } = useQuery({
        queryKey: ['entities', entityDefinitionId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('entities')
                .select('id, name, metadata')
                .eq('entity_definition_id', entityDefinitionId)
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data;
        },
    });

    // Fetch attendance
    const { data: attendanceData, refetch } = useQuery({
        queryKey: ['attendance', entityDefinitionId, selectedDate],
        queryFn: async () => {
            const start = startOfMonth(selectedDate);
            const end = endOfMonth(selectedDate);

            const { data, error } = await supabase
                .from('attendance_records')
                .select('*')
                .gte('date', format(start, 'yyyy-MM-dd'))
                .lte('date', format(end, 'yyyy-MM-dd'))
                .order('date', { ascending: true });

            if (error) throw error;
            return data;
        },
    });

    const getAttendanceFor = (entityId: string, date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return attendanceData?.find(
            (record: any) => record.entity_id === entityId && record.date === dateStr
        );
    };

    const getSummary = (entityId: string) => {
        const records = attendanceData?.filter((r: any) => r.entity_id === entityId) || [];
        const present = records.filter((r: any) => r.status === 'present').length;
        const total = records.length || 1;
        const rate = Math.round((present / total) * 100);
        return { present, total, rate };
    };

    // Quick mark attendance with one click
    const handleQuickMark = async (entityId: string, status: string) => {
        try {
            const companyId = await getCompanyId();
            const { data: userData } = await supabase.auth.getUser();
            const dateStr = format(selectedDate, 'yyyy-MM-dd');

            const { error } = await supabase
                .from('attendance_records')
                .upsert({
                    company_id: companyId,
                    entity_id: entityId,
                    date: dateStr,
                    status: status,
                    created_by: userData.user?.id,
                    notes: notes || null,
                }, { onConflict: 'entity_id,date' });

            if (error) throw error;

            toast.success(`✅ Marked as ${STATUS_OPTIONS.find(s => s.value === status)?.label}`);
            refetch();
        } catch (error: any) {
            toast.error(error.message || 'Failed to mark attendance');
        }
    };

    // Mark all with same status
    const handleMarkAll = async (status: string) => {
        if (!entities || entities.length === 0) {
            toast.error('No people found');
            return;
        }

        try {
            const companyId = await getCompanyId();
            const { data: userData } = await supabase.auth.getUser();
            const dateStr = format(selectedDate, 'yyyy-MM-dd');

            for (const entity of entities) {
                await supabase
                    .from('attendance_records')
                    .upsert({
                        company_id: companyId,
                        entity_id: entity.id,
                        date: dateStr,
                        status: status,
                        created_by: userData.user?.id,
                    }, { onConflict: 'entity_id,date' });
            }

            toast.success(`✅ Marked all as ${STATUS_OPTIONS.find(s => s.value === status)?.label}`);
            refetch();
        } catch (error: any) {
            toast.error(error.message || 'Failed to mark all');
        }
    };

    // Quick mark for a specific person with dropdown
    const handleQuickMarkWithDropdown = async () => {
        if (!selectedEntityId) {
            toast.error('Please select a person');
            return;
        }
        await handleQuickMark(selectedEntityId, quickStatus);
        setSelectedEntityId('');
    };

    // Export report
    const handleExport = async () => {
        try {
            const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

            const { data: records } = await supabase
                .from('attendance_records')
                .select(`*, entities(name, metadata)`)
                .gte('date', start)
                .lte('date', end);

            const rows = [['Name', 'Date', 'Status', 'Notes']];
            records?.forEach((record: any) => {
                rows.push([
                    record.entities?.name || 'Unknown',
                    record.date,
                    STATUS_OPTIONS.find(s => s.value === record.status)?.label || record.status,
                    record.notes || '',
                ]);
            });

            const csv = rows.map(row => row.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Attendance_${format(selectedDate, 'MMM_yyyy')}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('📥 Report downloaded!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to export');
        }
    };

    const monthDays = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
    });

    // Get today's date string for comparison
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isTodaySelected = format(selectedDate, 'yyyy-MM-dd') === todayStr;

    if (entitiesLoading) {
        return <div className="flex items-center justify-center h-64">Loading...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{entities?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">Total People</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-green-600">
                            {attendanceData?.filter((r: any) => r.status === 'present' && r.date === todayStr).length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">✅ Today</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-red-600">
                            {attendanceData?.filter((r: any) => r.status === 'absent' && r.date === todayStr).length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">❌ Absent</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold text-yellow-600">
                            {attendanceData?.filter((r: any) => r.status === 'late' && r.date === todayStr).length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">🕐 Late</p>
                    </CardContent>
                </Card>
            </div>

            {/* Month Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const d = new Date(selectedDate);
                            d.setMonth(d.getMonth() - 1);
                            setSelectedDate(d);
                        }}
                    >
                        ←
                    </Button>
                    <span className="text-base font-semibold min-w-[120px] text-center">
                        {format(selectedDate, 'MMM yyyy')}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const d = new Date(selectedDate);
                            d.setMonth(d.getMonth() + 1);
                            setSelectedDate(d);
                        }}
                    >
                        →
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
                        Today
                    </Button>
                </div>
                <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="h-3 w-3 mr-1" />
                        Export
                    </Button>
                    <Button size="sm" onClick={() => setShowBulkDialog(true)}>
                        <Users className="h-3 w-3 mr-1" />
                        Mark All
                    </Button>
                </div>
            </div>

            {/* Quick Mark Bar */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium mr-1">Quick Mark:</span>

                        {/* Quick status buttons */}
                        {QUICK_STATUSES.map((status) => (
                            <Button
                                key={status.value}
                                size="sm"
                                className={cn(
                                    "h-8 px-2 text-white",
                                    status.color,
                                    quickStatus === status.value && "ring-2 ring-offset-2 ring-primary"
                                )}
                                onClick={() => setQuickStatus(status.value)}
                            >
                                {status.label}
                            </Button>
                        ))}

                        <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                            <SelectTrigger className="w-[140px] h-8">
                                <SelectValue placeholder="Select person..." />
                            </SelectTrigger>
                            <SelectContent>
                                {entities?.map((entity: any) => (
                                    <SelectItem key={entity.id} value={entity.id}>
                                        {entity.metadata?.full_name || entity.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            size="sm"
                            onClick={handleQuickMarkWithDropdown}
                            disabled={!selectedEntityId}
                        >
                            Mark
                        </Button>

                        {/* Notes input */}
                        <Input
                            placeholder="Notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-8 w-[120px] text-sm"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* One-click mark all buttons */}
            <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">Mark all as:</span>
                {QUICK_STATUSES.map((status) => (
                    <Button
                        key={status.value}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleMarkAll(status.value)}
                    >
                        {status.label}
                    </Button>
                ))}
            </div>

            {/* Attendance Grid */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <div className="min-w-[800px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 bg-background min-w-[100px]">Name</TableHead>
                                    {monthDays.map((day) => (
                                        <TableHead
                                            key={day.toString()}
                                            className={cn(
                                                "text-center p-0.5 min-w-[28px]",
                                                isWeekend(day) && "text-muted-foreground",
                                                isToday(day) && "bg-muted"
                                            )}
                                        >
                                            <div className="text-[10px]">{format(day, 'd')}</div>
                                            <div className="text-[8px] text-muted-foreground">
                                                {format(day, 'EEE')}
                                            </div>
                                        </TableHead>
                                    ))}
                                    <TableHead className="text-center min-w-[60px]">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entities?.map((entity: any) => {
                                    const summary = getSummary(entity.id);
                                    return (
                                        <TableRow key={entity.id}>
                                            <TableCell className="sticky left-0 bg-background font-medium text-sm">
                                                {entity.metadata?.full_name || entity.name}
                                            </TableCell>
                                            {monthDays.map((day) => {
                                                const record = getAttendanceFor(entity.id, day);
                                                const status = record?.status || '';
                                                const color = STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-100';
                                                const isToday = format(day, 'yyyy-MM-dd') === todayStr;
                                                return (
                                                    <TableCell
                                                        key={day.toString()}
                                                        className="text-center p-0.5"
                                                    >
                                                        <button
                                                            className={cn(
                                                                "w-6 h-6 rounded-full mx-auto transition-all hover:scale-110 flex items-center justify-center text-xs font-bold",
                                                                color,
                                                                !record && "bg-gray-100 hover:bg-gray-200",
                                                                isToday && "ring-2 ring-offset-1 ring-primary"
                                                            )}
                                                            onClick={() => {
                                                                if (record) {
                                                                    // Toggle through statuses on click
                                                                    const statuses = ['present', 'absent', 'late', 'leave'];
                                                                    const currentIndex = statuses.indexOf(status);
                                                                    const nextIndex = (currentIndex + 1) % statuses.length;
                                                                    handleQuickMark(entity.id, statuses[nextIndex]);
                                                                } else {
                                                                    handleQuickMark(entity.id, 'present');
                                                                }
                                                            }}
                                                            title={record ? `Click to change status` : 'Click to mark present'}
                                                        >
                                                            {record ? STATUS_OPTIONS.find(s => s.value === status)?.icon || '✓' : ''}
                                                        </button>
                                                        {record?.check_in_time && (
                                                            <div className="text-[6px] text-muted-foreground mt-0.5">
                                                                {record.check_in_time.substring(0, 5)}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell className="text-center">
                                                <div className="text-sm font-medium">
                                                    {summary.rate}%
                                                </div>
                                                <div className="text-[8px] text-muted-foreground">
                                                    {summary.present}/{summary.total}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Bulk Mark Dialog */}
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mark All {entityName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Status for {format(selectedDate, 'MMM d, yyyy')}</Label>
                            <Select value={bulkStatus} onValueChange={setBulkStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This will mark all {entities?.length || 0} {entityName.toLowerCase()} as {STATUS_OPTIONS.find(s => s.value === bulkStatus)?.label}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                await handleMarkAll(bulkStatus);
                                setShowBulkDialog(false);
                            }}
                        >
                            Mark All
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}