import { useQuery } from "@tanstack/react-query"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Cpu, ShieldCheck, TriangleAlert } from "lucide-react"
import { api } from "@/lib/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const config = { value: { label: "Signal", color: "#57d1bd" } } satisfies ChartConfig

// Live view of the SIMULATED acquisition device: generated signals over MQTT with frame integrity checks.
export function SimulatedDevicePanel() {
  const status = useQuery({ queryKey: ["telemetryDevices"], queryFn: api.telemetryDevices, refetchInterval: 2000, retry: false })
  const device = status.data?.devices[0]
  const window = useQuery({ queryKey: ["telemetryWindow", device?.device_id], queryFn: () => api.telemetryWindow(device!.device_id, 5),
    enabled: Boolean(device), refetchInterval: 1000, retry: false })
  return (
    <Card className="min-w-0">
      <CardHeader className="gap-2">
        <CardDescription>Telemetry prototype</CardDescription>
        <CardTitle role="heading" aria-level={3} className="flex items-center gap-2"><Cpu aria-hidden />Simulated acquisition device</CardTitle>
        <Alert><TriangleAlert /><AlertTitle>Simulated device</AlertTitle><AlertDescription>{status.data?.label ?? "Synthetic signals, not FiSaV, not patient data, no model applied."}</AlertDescription></Alert>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="m-0 text-sm text-muted-foreground">Broker {status.data?.broker ?? "not configured"} · {status.data?.connected ? "connected" : "not connected"}. Each frame carries a sequence number, a timestamp and a CRC32 that the server checks.</p>
        {!device && <p className="m-0 text-sm">No simulated device is streaming. Start it with <code>docker compose --profile device up -d sim-device</code>.</p>}
        {device && <div className="flex flex-wrap gap-2" aria-label="Frame integrity">
          <Badge variant={device.integrity.integrity_ok ? "secondary" : "outline"}><ShieldCheck data-icon="inline-start" />{device.integrity.frames_received} frames verified</Badge>
          <Badge variant="outline">{device.integrity.crc_failures} CRC failures</Badge>
          <Badge variant="outline">{device.integrity.missing_frames} missing frames</Badge>
          <Badge variant="outline">{device.integrity.out_of_order} out of order</Badge>
          {window.data?.heart_rate_bpm != null && <Badge variant="outline">{window.data.heart_rate_bpm.toFixed(0)} bpm (rule-based R peaks)</Badge>}
        </div>}
        {window.data && window.data.channels.map((name, channel) => (
          <figure key={name} className="m-0 grid gap-1">
            <figcaption className="text-xs text-muted-foreground">{name} · last {window.data.seconds} s</figcaption>
            <ChartContainer config={config} className="aspect-auto h-28 w-full" role="img" aria-label={`${name}, last ${window.data.seconds} seconds`}>
              <LineChart data={window.data.time_sec[channel].map((t, i) => ({ t, v: window.data!.values[channel][i] }))} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis type="number" dataKey="t" domain={["dataMin", "dataMax"]} hide />
                <YAxis width={48} domain={["auto", "auto"]} tickFormatter={value => Number(value).toPrecision(2)} />
                <Line dataKey="v" stroke="var(--color-value)" dot={false} isAnimationActive={false} />
              </LineChart>
            </ChartContainer>
          </figure>
        ))}
        <p className="m-0 text-xs text-muted-foreground">Missing and corrupted frames are injected on purpose by the simulator to show the integrity checks. Gaps are counted, never interpolated.</p>
      </CardContent>
    </Card>
  )
}
