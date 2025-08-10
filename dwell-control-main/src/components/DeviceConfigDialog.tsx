import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Device } from '@/types';
import { Separator } from '@/components/ui/separator';

const switchTypes = ['relay', 'light', 'fan', 'outlet', 'projector', 'ac'] as const;

const deviceFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  macAddress: z.string().min(12, 'MAC address must be 12 characters').max(17, 'MAC address must be 17 characters or less'),
  ipAddress: z.string()
    .min(7, 'IP address is required')
    .max(15, 'IP address must be 15 characters or less')
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IP address format')
    .refine((val) => val.split('.').every(num => parseInt(num) >= 0 && parseInt(num) <= 255), {
      message: "Each octet must be between 0 and 255"
    }),
  location: z.string().min(1, 'Location is required'),
  classroom: z.string().optional(),
  pirEnabled: z.boolean().default(false),
  pirGpio: z.number().min(0).max(40).optional(),
  pirAutoOffDelay: z.number().min(0).default(30),
  switches: z.array(z.object({
    name: z.string().min(1, 'Switch name is required'),
    relayGpio: z.number().min(0).max(40),
    type: z.enum(switchTypes),
    manualSwitchEnabled: z.boolean().default(false),
    manualSwitchGpio: z.number().optional(),
    usePir: z.boolean().default(false),
    dontAutoOff: z.boolean().default(false)
  })).min(1, 'At least one switch is required')
});

type DeviceFormValues = z.infer<typeof deviceFormSchema>;

interface DeviceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DeviceFormValues) => void;
  initialData?: Device;
}

export const DeviceConfigDialog: React.FC<DeviceConfigDialogProps> = ({ 
  open, 
  onOpenChange, 
  onSubmit, 
  initialData 
}) => {
  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: initialData || {
      name: '',
      macAddress: '',
      ipAddress: '',
      location: '',
      classroom: '',
      pirEnabled: false,
      pirGpio: undefined,
      pirAutoOffDelay: 30,
      switches: [{
        name: '',
        relayGpio: 0,
        type: 'relay',
        manualSwitchEnabled: false,
        manualSwitchGpio: undefined,
        usePir: false,
        dontAutoOff: false
      }]
    }
  });

  const handleSubmit = (data: DeviceFormValues) => {
    onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Device' : 'Add New Device'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="macAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MAC Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="00:11:22:33:44:55" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ipAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="192.168.1.100" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="classroom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classroom (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="pirEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Enable PIR Sensor</FormLabel>
                  </FormItem>
                )}
              />

              {form.watch('pirEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="pirGpio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PIR GPIO Pin</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pirAutoOffDelay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auto-off Delay (seconds)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              {form.watch('switches')?.map((_, index) => (
                <div key={index} className="grid gap-4 p-4 border rounded-lg">
                  <FormField
                    control={form.control}
                    name={`switches.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Switch Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`switches.${index}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {switchTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`switches.${index}.relayGpio`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relay GPIO Pin</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`switches.${index}.manualSwitchEnabled`}
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Enable Manual Switch</FormLabel>
                      </FormItem>
                    )}
                  />

                  {form.watch(`switches.${index}.manualSwitchEnabled`) && (
                    <FormField
                      control={form.control}
                      name={`switches.${index}.manualSwitchGpio`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manual Switch GPIO Pin</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch('pirEnabled') && (
                    <>
                      <FormField
                        control={form.control}
                        name={`switches.${index}.usePir`}
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Link to PIR Sensor</FormLabel>
                          </FormItem>
                        )}
                      />

                      {form.watch(`switches.${index}.usePir`) && (
                        <FormField
                          control={form.control}
                          name={`switches.${index}.dontAutoOff`}
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="!mt-0">Keep On After Motion Stops</FormLabel>
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}

                  {index > 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        const switches = form.getValues('switches');
                        switches.splice(index, 1);
                        form.setValue('switches', [...switches]);
                      }}
                    >
                      Remove Switch
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const switches = form.getValues('switches');
                  form.setValue('switches', [
                    ...switches,
                    {
                      name: '',
                      relayGpio: 0,
                      type: 'relay',
                      manualSwitchEnabled: false,
                      manualSwitchGpio: undefined,
                      usePir: false,
                      dontAutoOff: false
                    }
                  ]);
                }}
              >
                Add Switch
              </Button>
            </div>

            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
