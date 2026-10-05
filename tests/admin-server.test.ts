import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  rpc: vi.fn(),
  limit: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  demoEnabled: vi.fn(),
}));
vi.mock("../src/lib/server/supabase", () => ({
  demoEnabled: mocks.demoEnabled,
  identity: mocks.identity,
  supabase: async () => ({ rpc: mocks.rpc }),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw new Error("Database unavailable");
    return r.data;
  },
}));
vi.mock("../src/lib/server/rate-limit", () => ({ rateLimit: mocks.limit }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));
import { requireAdmin, requireAdminPage } from "../src/lib/server/admin";
import { ApiError } from "../src/lib/server/http";
import { POST as canonical } from "../src/app/api/admin/route";
import { GET as entity } from "../src/app/api/admin/entity/route";
import {
  GET as records,
  POST as recordMutation,
} from "../src/app/api/admin/records/route";
import { GET as support } from "../src/app/api/admin/support/route";
import { POST as roleMutation } from "../src/app/api/admin/roles/route";
const uid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function request(
  path: string,
  data?: unknown,
  origin = "http://localhost:3000",
) {
  return new Request("http://localhost:3000/api/admin" + path, {
    ...(data !== undefined
      ? { method: "POST", body: JSON.stringify(data) }
      : {}),
    headers: { origin, "Content-Type": "application/json" },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  mocks.demoEnabled.mockReturnValue(false);
  mocks.identity.mockResolvedValue({ id: uid, demo: false });
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === "is_admin" ? false : null,
    error: null,
  }));
  mocks.redirect.mockImplementation(() => {
    throw new Error("redirect-login");
  });
  mocks.notFound.mockImplementation(() => {
    throw new Error("not-found");
  });
});
it("does not grant roles from client flags, Auth metadata or email domains", async () => {
  mocks.identity.mockResolvedValue({
    id: uid,
    email: "admin@musicmailapp.uk",
    demo: false,
    admin: true,
    role: "admin",
  });
  await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  expect(mocks.rpc).toHaveBeenCalledWith("is_admin");
});
it("rejects demo identity before calling the database", async () => {
  mocks.identity.mockResolvedValue({ id: uid, demo: true });
  await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects demo configuration without trying to write a page cookie", async () => {
  mocks.demoEnabled.mockReturnValue(true);
  await expect(requireAdminPage()).rejects.toThrow("not-found");
  expect(mocks.identity).not.toHaveBeenCalled();
});
it("fails closed when the role store is unavailable", async () => {
  mocks.rpc.mockResolvedValue({
    data: true,
    error: { message: "private provider error" },
  });
  await expect(requireAdmin()).rejects.toThrow("Database unavailable");
});
it("guards the server page with login/404 rather than client-only rendering", async () => {
  await expect(requireAdminPage()).rejects.toThrow("not-found");
  mocks.identity.mockRejectedValue(
    new ApiError("Verified sign-in required", 401),
  );
  await expect(requireAdminPage()).rejects.toThrow("redirect-login");
  expect(mocks.redirect).toHaveBeenCalledWith("/login");
});
it.each([
  ["canonical write", () => canonical(request("", {}))],
  ["canonical read", () => entity(request("/entity?id=" + uid))],
  ["related read", () => records(request("/records?table=genres"))],
  ["related write", () => recordMutation(request("/records", {}))],
  ["support", () => support(request("/support?view=users"))],
  ["role change", () => roleMutation(request("/roles", {}))],
])("denies normal members on %s", async (_name, call) => {
  const response = await call();
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.limit).not.toHaveBeenCalled();
});
it("returns 401 for an unverified or absent session", async () => {
  mocks.identity.mockRejectedValue(
    new ApiError("Verified sign-in required", 401),
  );
  expect((await support(request("/support?view=users"))).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("allows a trusted administrator support read and prevents caching", async () => {
  const payload = {
    total: 1,
    items: [{ id: uid, email: "member@example.test", role: "member" }],
  };
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === "is_admin" ? true : payload,
    error: null,
  }));
  const response = await support(request("/support?view=users&userId=" + uid));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(payload);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledWith("admin_users_page", {
    page_offset: 0,
    selected_user_id: uid,
  });
  expect(mocks.limit).toHaveBeenCalledWith("admin-read", uid, 180, 60);
});
it("validates support category, workspace UUID and pagination", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  for (const path of [
    "?view=records&section=gmail_connections&workspaceId=" + uid,
    "?view=records&section=notes&workspaceId=invalid",
    "?view=users&offset=-1",
    "?view=users&offset=100001",
  ])
    expect((await support(request("/support" + path))).status).toBe(400);
  expect(mocks.rpc).toHaveBeenCalledTimes(4);
});
it("rejects cross-origin and unconfirmed role changes before privileged RPC", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  const input = { userId: uid, role: "admin", confirmed: true };
  expect(
    (await roleMutation(request("/roles", input, "https://elsewhere.example")))
      .status,
  ).toBe(400);
  expect(
    (await roleMutation(request("/roles", { ...input, confirmed: false })))
      .status,
  ).toBe(400);
  expect(
    (await roleMutation(request("/roles", { ...input, role: "owner" }))).status,
  ).toBe(400);
  expect(
    (await roleMutation(request("/roles", { ...input, actorId: uid }))).status,
  ).toBe(400);
  expect(mocks.rpc.mock.calls.every(([name]) => name === "is_admin")).toBe(
    true,
  );
});
it("performs role changes through the atomic, audited database function", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  const response = await roleMutation(
    request("/roles", { userId: uid, role: "admin", confirmed: true }),
  );
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("admin_change_role", {
    target_user_id: uid,
    new_role: "admin",
    confirmed: true,
  });
  expect(mocks.limit).toHaveBeenCalledWith("admin-write", uid, 60, 60);
});
it("requires explicit confirmation for destructive shared records", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  expect(
    (await canonical(request("", { action: "archive", id: uid }))).status,
  ).toBe(400);
  expect(
    (
      await recordMutation(
        request("/records", {
          table: "genres",
          action: "delete",
          record: { id: uid },
        }),
      )
    ).status,
  ).toBe(400);
});
it("enforces admin rate limits before support reads", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.limit.mockRejectedValue(new ApiError("Too many attempts", 429, 60));
  const response = await support(request("/support?view=users"));
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
