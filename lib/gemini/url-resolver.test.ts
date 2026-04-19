import { describe, it, expect } from "vitest";
import { __internal, resolveUrl } from "./url-resolver";

const { isUnsafeIp } = __internal;

describe("isUnsafeIp", () => {
  it.each([
    ["127.0.0.1", "loopback v4"],
    ["127.1.2.3", "loopback range"],
    ["10.0.0.1", "private v4 10/8"],
    ["10.255.255.255", "private v4 10/8 high"],
    ["172.16.0.1", "private v4 172.16/12"],
    ["172.31.255.255", "private v4 172.31"],
    ["192.168.1.1", "private v4 192.168/16"],
    ["169.254.169.254", "AWS metadata"],
    ["169.254.1.1", "link-local v4"],
    ["0.0.0.0", "unspecified v4"],
    ["224.0.0.1", "multicast v4"],
    ["255.255.255.255", "broadcast v4"],
    ["::1", "loopback v6"],
    ["fe80::1", "link-local v6"],
    ["fc00::1", "unique-local v6"],
    ["fd00::1", "unique-local v6 fd"],
    ["ff02::1", "multicast v6"],
    ["::", "unspecified v6"],
    ["garbage", "unparsable"],
    ["999.999.999.999", "invalid v4"],
  ])("rejects %s (%s)", (ip) => {
    expect(isUnsafeIp(ip)).toBe(true);
  });

  it.each([
    ["8.8.8.8", "Google DNS"],
    ["1.1.1.1", "Cloudflare DNS"],
    ["142.250.190.46", "google.com public"],
    ["2001:4860:4860::8888", "Google IPv6"],
  ])("allows %s (%s)", (ip) => {
    expect(isUnsafeIp(ip)).toBe(false);
  });
});

describe("resolveUrl — input validation", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(resolveUrl("file:///etc/passwd")).rejects.toThrow(/Non-http/);
    await expect(resolveUrl("ftp://example.com")).rejects.toThrow(/Non-http/);
  });

  it("rejects invalid URLs", async () => {
    await expect(resolveUrl("not a url")).rejects.toThrow(/Invalid URL/);
  });

  it("rejects direct private-IP URLs", async () => {
    await expect(resolveUrl("http://127.0.0.1/")).rejects.toThrow(/SSRF/);
    await expect(resolveUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/SSRF/);
    await expect(resolveUrl("http://192.168.1.1/")).rejects.toThrow(/SSRF/);
    await expect(resolveUrl("http://[::1]/")).rejects.toThrow(/SSRF/);
  });
});
