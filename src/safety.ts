const DANGEROUS_PORTS: ReadonlySet<number> = new Set([
  22, // SSH
  25, // SMTP
  80, // HTTP
  110, // POP3
  143, // IMAP
  443, // HTTPS
  3306, // MySQL
  5432, // PostgreSQL
  5672, // RabbitMQ / AMQP
  6379, // Redis
  9200, // Elasticsearch
  27017, // MongoDB
]);

const PORT_DESCRIPTIONS: ReadonlyMap<number, string> = new Map([
  [22, 'SSH'],
  [25, 'SMTP (mail)'],
  [80, 'HTTP'],
  [110, 'POP3 (mail)'],
  [143, 'IMAP (mail)'],
  [443, 'HTTPS'],
  [3306, 'MySQL'],
  [5432, 'PostgreSQL'],
  [5672, 'RabbitMQ / AMQP'],
  [6379, 'Redis'],
  [9200, 'Elasticsearch'],
  [27017, 'MongoDB'],
]);

export function isDangerous(port: number): boolean {
  return DANGEROUS_PORTS.has(port);
}

export function dangerDescription(port: number): string | undefined {
  return PORT_DESCRIPTIONS.get(port);
}
