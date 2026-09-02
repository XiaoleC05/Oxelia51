import { randomUUID } from "crypto";

import { prisma, Role } from "@oxelia51/shared/src/db";

/**
 * adminDeleteUser 新语义的数据库级回归测试：
 * 管理台删除用户仅删用户本体（adminUserRouter.adminDeleteUser 内联 prisma.user.delete），
 * 组织/项目 memberships 由 schema onDelete: Cascade 清理，组织与项目本体保留
 * （单默认组织/项目机制仍在运行，不做级联清理）。
 * 管理员鉴权（superAdminProcedure 邮箱制）在 router 层，此处不覆盖。
 */
describe("adminDeleteUser 删除语义（仅删用户，级联清 memberships）", () => {
  it("删除用户后 memberships 级联清理，组织与项目保留", async () => {
    const id = randomUUID();
    const orgId = `org-${id}`;
    const projectId = `project-${id}`;
    const userId = `user-${id}`;

    await prisma.organization.create({
      data: { id: orgId, name: `Delete User Org ${id}` },
    });
    await prisma.project.create({
      data: { id: projectId, orgId, name: `Delete User Project ${id}` },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        name: "Delete User",
      },
    });
    const orgMembership = await prisma.organizationMembership.create({
      data: { orgId, userId, role: Role.OWNER },
    });
    await prisma.projectMembership.create({
      data: {
        projectId,
        userId,
        role: Role.OWNER,
        orgMembershipId: orgMembership.id,
      },
    });

    // 与 adminUserRouter.adminDeleteUser 相同的删除路径
    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    // memberships 由 schema onDelete: Cascade 清理
    expect(
      await prisma.organizationMembership.count({ where: { userId } }),
    ).toBe(0);
    expect(await prisma.projectMembership.count({ where: { userId } })).toBe(
      0,
    );
    // 组织与项目本体保留（不再级联删除）
    expect(
      await prisma.organization.findUnique({ where: { id: orgId } }),
    ).not.toBeNull();
    expect(
      await prisma.project.findUnique({ where: { id: projectId } }),
    ).not.toBeNull();

    // 清理测试数据（删组织连带项目）
    await prisma.organization.delete({ where: { id: orgId } });
  });
});
