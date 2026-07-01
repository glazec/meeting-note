import { Eye, RotateCcw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminImpersonatedUserId } from "@/lib/admin-access";
import {
  getAdminImpersonationTarget,
  listAdminImpersonationTargets,
} from "@/lib/admin-impersonation";
import { requireAdminUser } from "@/lib/auth-guards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdminUser();
  const [targets, impersonatedUserId] = await Promise.all([
    listAdminImpersonationTargets(),
    getAdminImpersonatedUserId(),
  ]);
  const currentTarget = impersonatedUserId
    ? await getAdminImpersonationTarget(impersonatedUserId)
    : null;

  return (
    <AppShell activeHref="/admin">
      <section className="flex flex-col gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-normal text-primary">
            Admin
          </p>
          <h1 className="mt-3 text-3xl font-semibold">User view control</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Signed in as {admin.email}. Choose a user to view and act as that
            account across the app.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Current view</CardTitle>
            <CardDescription>
              {currentTarget
                ? `Currently viewing as ${currentTarget.email}`
                : "You are using your own account."}
            </CardDescription>
          </CardHeader>
          {currentTarget ? (
            <CardContent>
              <form action="/api/admin/impersonation" method="post">
                <input name="action" type="hidden" value="clear" />
                <input name="redirectTo" type="hidden" value="/admin" />
                <button
                  className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
                  type="submit"
                >
                  <RotateCcw aria-hidden="true" />
                  Stop viewing as user
                </button>
              </form>
            </CardContent>
          ) : null}
        </Card>

        <Card className="gap-0 py-0 shadow-sm">
          <CardHeader className="border-b bg-muted/25 px-4 py-4 sm:px-5">
            <CardTitle>Choose user</CardTitle>
            <CardDescription>
              The selected user becomes the effective app user after redirect.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="border-b px-4 py-4 sm:px-5">
              <form
                action="/api/admin/impersonation"
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                method="post"
              >
                <input name="redirectTo" type="hidden" value="/dashboard" />
                <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium">
                  User
                  <select
                    className="h-8 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    defaultValue={currentTarget?.id ?? ""}
                    name="userId"
                    required
                  >
                    <option disabled value="">
                      Select user
                    </option>
                    {targets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.email}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={cn(buttonVariants(), "w-fit")} type="submit">
                  <Eye aria-hidden="true" />
                  View as user
                </button>
              </form>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell>
                      <div className="font-medium">{target.email}</div>
                      {target.name ? (
                        <div className="text-muted-foreground">{target.name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{target.teamName ?? "No team"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{target.role ?? "none"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <form action="/api/admin/impersonation" method="post">
                        <input name="redirectTo" type="hidden" value="/dashboard" />
                        <input name="userId" type="hidden" value={target.id} />
                        <button
                          className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                            "ml-auto",
                          )}
                          type="submit"
                        >
                          View as user
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
