import type { APIRoute } from 'astro';

interface MetricsData {
  total_files_processed: number;
  total_results_generated: number;
  total_results_displayed: number;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    // Get KV namespace from Cloudflare Worker runtime
    const runtime = (locals as any).runtime;
    const env = runtime?.env || {};
    const METRICS = env.METRICS;

    if (!METRICS) {
      return new Response(JSON.stringify({ error: 'Metrics not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Retrieve all metrics
    const [filesProcessed, resultsGenerated, resultsDisplayed] = await Promise.all([
      METRICS.get('total_files_processed'),
      METRICS.get('total_results_generated'),
      METRICS.get('total_results_displayed')
    ]);

    const metrics: MetricsData = {
      total_files_processed: parseInt(filesProcessed || '0', 10),
      total_results_generated: parseInt(resultsGenerated || '0', 10),
      total_results_displayed: parseInt(resultsDisplayed || '0', 10)
    };

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Get KV namespace from Cloudflare Worker runtime
    const runtime = (locals as any).runtime;
    const env = runtime?.env || {};
    const METRICS = env.METRICS;

    if (!METRICS) {
      return new Response(JSON.stringify({ error: 'Metrics not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { metric, increment = 1 } = body;

    // Validate metric name
    const validMetrics = ['total_files_processed', 'total_results_generated', 'total_results_displayed'];
    if (!validMetrics.includes(metric)) {
      return new Response(JSON.stringify({ error: 'Invalid metric name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current value
    const currentValue = await METRICS.get(metric);
    const current = parseInt(currentValue || '0', 10);
    const newValue = current + increment;

    // Store updated value
    await METRICS.put(metric, newValue.toString());

    return new Response(JSON.stringify({ 
      metric, 
      previousValue: current, 
      newValue,
      increment 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating metrics:', error);
    return new Response(JSON.stringify({ error: 'Failed to update metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};