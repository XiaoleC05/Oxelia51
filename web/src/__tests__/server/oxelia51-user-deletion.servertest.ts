import { randomUUID } from "crypto";

import { prisma, Role } from "@oxelia51/shared/src/db";
import { deleteUserWithOrgCascade } from "@/src/features/oxelia51/server/userDeletion";

/**
 * adminDeleteUser 的级联规则单测（deleteUserWithOrgCascade）：
 * - 唯一成员组织（唯一所有者且无其他成员）→ 级联删除组织（连同项目）；
 * - 组织内还有其他成员 → PRECONDITION_FAILED，用户与组织均保留。
 * 通过 prisma.$transaction 驱动，与 adminRouter 中的调用方式一致；
 * Redis API key 失效在 router 层（此处不覆盖）。
 */
describe("deleteUserWithOrgCascade", () => {
  it("级联删除唯一成员组织（连同其项目）", async () => {
    const id = randomUUID();
    const orgId = `org-${id}`;
    const projectId = `project-${id}`;
    const userId = `user-${id}`;

    await prisma.organization.create({
      data: { id: orgId, name: `Cascade Org ${id}` },
    });
    await prisma.project.create({
      data: { id: projectId, orgId, name: `Cascade Project ${id}` },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        name: "Cascade User",
      },
    });
    await prisma.organizationMembership.create({
      data: { orgId, userId, role: Role.OWNER },
    });

    const result = await prisma.$transaction((tx) =>
      deleteUserWithOrgCascade(userId, tx),
    );

    expect(result.deletedOrganizations).toEqual([
      { id: orgId, name: `Cascade Org ${id}` },
    ]);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(
      await prisma.organization.findUnique({ where: { id: orgId } }),
    ).toBeNull();
    // 组织删除经 schema onDelete: Cascade 连带删除项目
    expect(
      await prisma.project.findUnique({ where: { id: projectId } }),
    ).toBeNull();
  });

  it("组织内还有其他成员时阻断删除并说明成员数", async () => {
    const id = randomUUID();
    const orgId = `org-${id}`;
    const ownerId = `owner-${id}`;
    const memberId = `member-${id}`;

    await prisma.organization.create({
      data: { id: orgId, name: `Blocked Org ${id}` },
    });
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.com`,
        name: "Blocked Owner",
      },
    });
    await prisma.user.create({
      data: {
        id: memberId,
        email: `${memberId}@example.com`,
        name: "Blocked Member",
      },
    });
    await prisma.organizationMembership.create({
      data: { orgId, userId: ownerId, role: Role.OWNER },
    });
    await prisma.organizationMembership.create({
      data: { orgId, userId: memberId, role: Role.VIEWER },
    });

    await expect(
      prisma.$transaction((tx) => deleteUserWithOrgCascade(ownerId, tx)),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining(
        `该用户仍是组织「Blocked Org ${id}」的唯一所有者（组织内还有 1 名其他成员），请先移交所有者`,
      ),
    });

    // 事务回滚：用户、组织、两名成员关系均保留
    expect(
      await prisma.user.findUnique({ where: { id: ownerId } }),
    ).not.toBeNull();
    expect(
      await prisma.organization.findUnique({ where: { id: orgId } }),
    ).not.toBeNull();
    expect(
      await prisma.organizationMembership.count({ where: { orgId } }),
    ).toBe(2);

    // 清理测试数据（cascade：删组织连带 membership）
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.user.delete({ where: { id: memberId } });
  });

  it("非最后所有者的用户直接删除、不级联组织", async () => {
    const id = randomUUID();
    const orgId = `org-${id}`;
    const userId = `user-${id}`;
    const otherOwnerId = `owner-${id}`;

    await prisma.organization.create({
      data: { id: orgId, name: `Shared Org ${id}` },
    });
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, name: "Plain User" },
    });
    await prisma.user.create({
      data: {
        id: otherOwnerId,
        email: `${otherOwnerId}@example.com`,
        name: "Other Owner",
      },
    });
    await prisma.organizationMembership.create({
      data: { orgId, userId, role: Role.OWNER },
    });
    await prisma.organizationMembership.create({
      data: { orgId, userId: otherOwnerId, role: Role.OWNER },
    });

    const result = await prisma.$transaction((tx) =>
      deleteUserWithOrgCascade(userId, tx),
    );

    expect(result.deletedOrganizations).toEqual([]);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(
      await prisma.organization.findUnique({ where: { id: orgId } }),
    ).not.toBeNull();

    // 清理测试数据
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.user.delete({ where: { id: otherOwnerId } });
  });
});
