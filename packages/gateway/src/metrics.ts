// Forge — Prometheus Metrics Endpoint
// Lightweight in-process metrics collection and exposition

type MetricType = "counter" | "gauge" | "histogram";

interface Metric {
  name: string;
  help: string;
  type: MetricType;
  labels?: Record<string, string>;
}

interface CounterMetric extends Metric {
  type: "counter";
  value: number;
}

interface GaugeMetric extends Metric {
  type: "gauge";
  value: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramMetric extends Metric {
  type: "histogram";
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

type MetricEntry = CounterMetric | GaugeMetric | HistogramMetric;

class MetricsRegistry {
  private metrics: Map<string, MetricEntry> = new Map();
  private defaultLabels: Record<string, string> = {};

  constructor() {
    this.defaultLabels = {
      service: process.env.SERVICE_NAME || "forge-gateway",
    };
  }

  private key(name: string, labels?: Record<string, string>): string {
    const allLabels = { ...this.defaultLabels, ...labels };
    return `${name}{${Object.entries(allLabels).map(([k, v]) => `${k}="${v}"`).join(",")}}`;
  }

  counter(name: string, help: string, labels?: Record<string, string>): void {
    const k = this.key(name, labels);
    if (!this.metrics.has(k)) {
      this.metrics.set(k, {
        name,
        help,
        type: "counter",
        labels: { ...this.defaultLabels, ...labels },
        value: 0,
      } as CounterMetric);
    }
  }

  gauge(name: string, help: string, labels?: Record<string, string>): void {
    const k = this.key(name, labels);
    if (!this.metrics.has(k)) {
      this.metrics.set(k, {
        name,
        help,
        type: "gauge",
        labels: { ...this.defaultLabels, ...labels },
        value: 0,
      } as GaugeMetric);
    }
  }

  histogram(name: string, help: string, buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]): void {
    const k = this.key(name);
    if (!this.metrics.has(k)) {
      this.metrics.set(k, {
        name,
        help,
        type: "histogram",
        labels: { ...this.defaultLabels },
        buckets: buckets.map((le) => ({ le, count: 0 })),
        sum: 0,
        count: 0,
      } as HistogramMetric);
    }
  }

  inc(name: string, value = 1, labels?: Record<string, string>): void {
    const k = this.key(name, labels);
    const entry = this.metrics.get(k);
    if (entry && entry.type === "counter") {
      (entry as CounterMetric).value += value;
    }
  }

  set(name: string, value: number, labels?: Record<string, string>): void {
    const k = this.key(name, labels);
    const entry = this.metrics.get(k);
    if (entry && entry.type === "gauge") {
      (entry as GaugeMetric).value = value;
    }
  }

  observe(name: string, value: number, labels?: Record<string, string>): void {
    const k = this.key(name, labels);
    const entry = this.metrics.get(k);
    if (entry && entry.type === "histogram") {
      const hist = entry as HistogramMetric;
      hist.sum += value;
      hist.count++;
      for (const bucket of hist.buckets) {
        if (value <= bucket.le) {
          bucket.count++;
        }
      }
    }
  }

  export(): string {
    let output = "";

    for (const [, entry] of this.metrics) {
      output += `# HELP ${entry.name} ${entry.help}\n`;
      output += `# TYPE ${entry.name} ${entry.type}\n`;

      const labelStr = entry.labels
        ? `{${Object.entries(entry.labels).map(([k, v]) => `${k}="${v}"`).join(",")}}`
        : "";

      switch (entry.type) {
        case "counter":
        case "gauge": {
          const v = (entry as CounterMetric | GaugeMetric).value;
          output += `${entry.name}${labelStr} ${v}\n`;
          break;
        }
        case "histogram": {
          const hist = entry as HistogramMetric;
          for (const bucket of hist.buckets) {
            output += `${entry.name}_bucket{${labelStr ? labelStr.slice(1, -1) + "," : ""}le="${bucket.le}"} ${bucket.count}\n`;
          }
          output += `${entry.name}_bucket{${labelStr ? labelStr.slice(1, -1) + "," : ""}le="+Inf"} ${hist.count}\n`;
          output += `${entry.name}_sum${labelStr} ${hist.sum}\n`;
          output += `${entry.name}_count${labelStr} ${hist.count}\n`;
          break;
        }
      }
    }

    return output;
  }
}

// Singleton
export const metrics = new MetricsRegistry();

// Register default metrics
metrics.counter("http_requests_total", "Total HTTP requests", { method: "GET", path: "/v1/health" });
metrics.counter("http_requests_total", "Total HTTP requests", { method: "POST", path: "/v1/db/query" });
metrics.counter("http_requests_total", "Total HTTP requests", { method: "POST", path: "/v1/storage/upload-url" });
metrics.counter("http_requests_total", "Total HTTP requests", { method: "GET", path: "/v1/storage/download-url" });
metrics.counter("http_requests_total", "Total HTTP requests", { method: "POST", path: "/v1/functions/invoke" });
metrics.counter("http_requests_total", "Total HTTP requests", { method: "POST", path: "/v1/webhooks" });
metrics.counter("http_requests_total", "Total HTTP requests", { method: "GET", path: "/v1/auth/me" });
metrics.counter("http_requests_total", "Total HTTP requests", { method: "GET", path: "/metrics" });

metrics.histogram("http_request_duration_seconds", "HTTP request duration in seconds");

metrics.gauge("up", "Service up status");
metrics.set("up", 1);

metrics.gauge("active_connections", "Number of active connections");

// Track per-status-code
metrics.counter("http_requests_total", "Total HTTP requests by status", { status: "2xx" });
metrics.counter("http_requests_total", "Total HTTP requests by status", { status: "4xx" });
metrics.counter("http_requests_total", "Total HTTP requests by status", { status: "5xx" });

export async function registerMetricsRoute(app: any): Promise<void> {
  app.get("/metrics", async (_request: any, reply: any) => {
    reply.header("Content-Type", "text/plain; charset=utf-8");
    return reply.send(metrics.export());
  });
}
