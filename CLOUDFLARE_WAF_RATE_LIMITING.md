# Cloudflare WAF Rate Limiting Configuration

**Version:** 1.0  
**Last Updated:** January 2025  
**Purpose:** Configuration guide for Cloudflare WAF rate limiting rules to protect TYL APIs from abuse and DoS attacks

## Overview

This document provides step-by-step instructions for configuring Cloudflare WAF rate limiting rules through the Cloudflare dashboard. These rules work in conjunction with the application-level rate limiting implemented in the Workers code.

## Two-Layer Protection Strategy

1. **Edge Layer (WAF)**: Blocks malicious traffic at Cloudflare's edge before it reaches your Worker
2. **Application Layer (Worker)**: Fine-grained rate limiting with proper headers and user feedback

## Dashboard Configuration Steps

### Access WAF Rate Limiting

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain: `trackyourlabs.com`
3. Navigate to: **Security** → **WAF** → **Rate limiting rules**
4. Click **Create rule** to add each rule below

## Required Rate Limiting Rules

### Rule 1: General API Protection

**Purpose:** Protect all API endpoints from excessive requests

**Configuration:**
- **Rule name:** `API General Rate Limit`
- **When incoming requests match:**
  ```
  Expression: (http.request.uri.path contains "/api/")
  ```
- **Rate:** `100` requests
- **Period:** `1 minute`
- **Characteristics:** 
  - ✅ IP address
- **Then take action:** `Block`
- **Duration:** `1 minute` (60 seconds)
- **Response type:** `Custom JSON response`
- **Response body:**
  ```json
  {
    "error": "Rate limit exceeded",
    "message": "Too many requests. Please try again in 1 minute."
  }
  ```

---

### Rule 2: Burst Protection

**Purpose:** Prevent rapid-fire requests that could overwhelm the system

**Configuration:**
- **Rule name:** `API Burst Protection`
- **When incoming requests match:**
  ```
  Expression: (http.request.uri.path contains "/api/")
  ```
- **Rate:** `20` requests
- **Period:** `10 seconds`
- **Characteristics:** 
  - ✅ IP address
- **Then take action:** `Managed Challenge`
- **Duration:** `30 seconds`

---

## Advanced Configuration (Optional)

### Rule 3: Geographic Rate Limiting

**Purpose:** Apply different limits based on geographic location (if needed)

**Configuration:**
- **Rule name:** `Geographic Rate Limit`
- **When incoming requests match:**
  ```
  Expression: (http.request.uri.path contains "/api/" and ip.geoip.country ne "US")
  ```
- **Rate:** `50` requests
- **Period:** `1 minute`
- **Characteristics:** 
  - ✅ IP address
  - ✅ Country
- **Then take action:** `Block`
- **Duration:** `2 minutes` (120 seconds)

### Rule 4: User Agent Protection

**Purpose:** Block automated tools and suspicious user agents

**Configuration:**
- **Rule name:** `Bot Protection`
- **When incoming requests match:**
  ```
  Expression: (http.request.uri.path contains "/api/" and 
    (http.user_agent contains "bot" or 
     http.user_agent contains "crawler" or 
     http.user_agent contains "scraper" or
     http.user_agent eq ""))
  ```
- **Rate:** `5` requests
- **Period:** `1 minute`
- **Characteristics:** 
  - ✅ IP address
  - ✅ User Agent
- **Then take action:** `Block`
- **Duration:** `10 minutes` (600 seconds)

## Rule Priority Order

Cloudflare processes rate limiting rules in order. Arrange them as follows:

1. API Burst Protection (shortest window - 10 seconds)
2. API General Rate Limit (catch-all - 1 minute)
3. Geographic Rate Limit (optional)
4. Bot Protection (optional)

## Testing Your Configuration

### Test Commands

1. **Test normal usage (should succeed):**
   ```bash
   curl -X POST https://trackyourlabs.com/api/extract-labs \
     -H "Content-Type: application/json" \
     -d '{"files": []}'
   ```

2. **Test rate limiting (run multiple times quickly):**
   ```bash
   for i in {1..15}; do
     curl -X POST https://trackyourlabs.com/api/extract-labs \
       -H "Content-Type: application/json" \
       -d '{"files": []}' \
       -w "\nStatus: %{http_code}\n"
     sleep 0.5
   done
   ```

3. **Check response headers:**
   ```bash
   curl -I -X POST https://trackyourlabs.com/api/extract-labs \
     -H "Content-Type: application/json"
   ```

### Expected Behavior

- First 20 requests to `/api/*` within 10 seconds: **Success**
- 21st request within 10 seconds: **Challenge presented**
- First 100 requests to `/api/*` within a minute: **Success (200)**
- 101st request: **Blocked (429)** with 1-minute timeout
- Headers should include: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

## Monitoring & Alerts

### Dashboard Monitoring

1. Navigate to **Analytics** → **Security**
2. Filter by **Rate limiting rules**
3. Monitor:
   - Total requests blocked
   - Top blocked IPs
   - Rule hit frequency
   - Geographic distribution

### Set Up Alerts

1. Go to **Notifications**
2. Create alert for:
   - Rate limit threshold exceeded (>1000 blocks/hour)
   - Specific IP hitting limits repeatedly
   - Unusual geographic patterns

## Troubleshooting

### Common Issues

1. **Legitimate users blocked:**
   - Review IP addresses in Analytics
   - Consider increasing limits
   - Add IP allowlist for known good actors

2. **Rules not triggering:**
   - Verify expression syntax
   - Check rule ordering
   - Ensure rules are enabled

3. **False positives:**
   - Refine user agent patterns
   - Adjust geographic restrictions
   - Consider time-of-day variations

### Bypass Rules (Emergency)

If you need to temporarily bypass rate limiting for testing:

1. Go to **Security** → **WAF** → **Tools**
2. Add IP to allowlist
3. **Remember to remove after testing!**

## Best Practices

1. **Start Conservative:** Begin with higher limits and reduce gradually
2. **Monitor Closely:** Watch for false positives in the first week
3. **Document Changes:** Log all rule modifications
4. **Regular Reviews:** Review effectiveness monthly
5. **Coordinate Changes:** Sync WAF changes with application deployments

## Rate Limiting Implementation

All rate limiting is handled by Cloudflare WAF at the edge:

| Rule | Endpoint | Limit | Period | Action |
|------|----------|-------|--------|--------|
| API Burst Protection | /api/* | 20 | 10 sec | Challenge |
| API General Rate Limit | /api/* | 100 | 1 min | Block 1 min |

**Benefits of WAF-only approach:**
- No application code required or maintained
- Better performance (stops attacks at edge)
- Lower compute costs (no Worker execution for blocked requests)
- Centralized configuration in Cloudflare dashboard
- Consistent rate limiting across all endpoints

## Compliance Considerations

### HIPAA Requirements
- Rate limiting helps prevent data enumeration attacks
- Protects against resource exhaustion
- Maintains service availability for legitimate users
- All blocked requests should be logged (without PHI)

### Privacy
- Rate limiting rules only use IP addresses and request metadata
- No inspection of request body content
- No storage of PHI in WAF logs

## Rollback Procedure

If rate limiting causes issues:

1. **Immediate:** Disable problematic rule in dashboard
2. **Temporary:** Increase limits by 2x
3. **Investigation:** Review logs to understand pattern
4. **Resolution:** Adjust rules based on findings
5. **Document:** Update this guide with lessons learned

## Change Log

| Date | Change | Author |
|------|--------|--------|
| Jan 2025 | Initial configuration | Security Team |

## Contact

For questions or issues with rate limiting:
- **Escalation:** Security team via Slack #security
- **Dashboard Access:** Request via IT ticket
- **Rule Changes:** Require security team approval

---

**Note:** This configuration is for the production environment. Adjust limits for staging/development as needed.