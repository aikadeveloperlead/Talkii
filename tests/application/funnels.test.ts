import { describe, expect, it } from "vitest";
import { Agent, DomainError, Identity } from "@/domain";
import {
  AddFunnelStep,
  AssignFunnelToAgent,
  CreateFunnel,
  DeleteFunnelStep,
  GetFunnelDetail,
  ReorderFunnelSteps,
  SetFunnelStatus,
  UnassignFunnelFromAgent,
  UpdateFunnel,
  UpdateFunnelStep,
} from "@/application/use-cases";
import { InMemoryAgents, InMemoryFunnels, SequentialIds } from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

function setup() {
  const ids = new SequentialIds();
  const funnels = new InMemoryFunnels();
  const agents = new InMemoryAgents();
  return {
    funnels,
    agents,
    createFunnel: new CreateFunnel(ids, funnels),
    updateFunnel: new UpdateFunnel(funnels),
    setStatus: new SetFunnelStatus(funnels),
    addStep: new AddFunnelStep(funnels),
    updateStep: new UpdateFunnelStep(funnels),
    deleteStep: new DeleteFunnelStep(funnels),
    reorderSteps: new ReorderFunnelSteps(funnels),
    getDetail: new GetFunnelDetail(funnels),
    assignFunnel: new AssignFunnelToAgent(agents, funnels),
    unassignFunnel: new UnassignFunnelFromAgent(agents),
  };
}

const baseStages = [
  { name: "Saludo", objective: "dar bienvenida", transitionCriteria: "cliente responde", stepKey: "saludo", order: 0 },
];

describe("CreateFunnel (SCR-010 BK-01 nombre único, BK-02 al menos un paso)", () => {
  it("crea en estado draft", async () => {
    const { createFunnel, getDetail } = setup();
    const { funnelId } = await createFunnel.execute({ tenantId, name: "Ventas", stages: baseStages });
    expect((await getDetail.execute(funnelId))?.status).toBe("draft");
  });

  it("rechaza nombre duplicado", async () => {
    const { createFunnel } = setup();
    await createFunnel.execute({ tenantId, name: "Ventas", stages: baseStages });
    await expect(
      createFunnel.execute({ tenantId, name: "Ventas", stages: baseStages }),
    ).rejects.toThrow(DomainError);
  });

  it("rechaza stepKey u orden repetidos (BK-03/BK-04)", async () => {
    const { createFunnel } = setup();
    await expect(
      createFunnel.execute({
        tenantId,
        name: "Ventas",
        stages: [...baseStages, { ...baseStages[0] }],
      }),
    ).rejects.toThrow(DomainError);
  });
});

describe("Pasos: AddFunnelStep / UpdateFunnelStep / DeleteFunnelStep / ReorderFunnelSteps", () => {
  it("agrega, edita, reordena y elimina pasos", async () => {
    const { createFunnel, addStep, updateStep, reorderSteps, deleteStep, getDetail } = setup();
    const { funnelId } = await createFunnel.execute({ tenantId, name: "Ventas", stages: baseStages });

    await addStep.execute(funnelId, {
      name: "Calificar",
      objective: "calificar lead",
      transitionCriteria: "responde presupuesto",
      stepKey: "calificar",
      order: 1,
    });
    expect((await getDetail.execute(funnelId))?.stages).toHaveLength(2);

    await updateStep.execute(funnelId, "calificar", { name: "Calificar lead" });
    expect(
      (await getDetail.execute(funnelId))?.stages.find((s) => s.stepKey === "calificar")?.name,
    ).toBe("Calificar lead");

    await reorderSteps.execute(funnelId, ["calificar", "saludo"]);
    const reordered = await getDetail.execute(funnelId);
    expect(reordered?.stages.find((s) => s.stepKey === "calificar")?.order).toBe(0);
    expect(reordered?.stages.find((s) => s.stepKey === "saludo")?.order).toBe(1);

    await deleteStep.execute(funnelId, "calificar");
    expect((await getDetail.execute(funnelId))?.stages).toHaveLength(1);
  });
});

describe("SetFunnelStatus / AssignFunnelToAgent / UnassignFunnelFromAgent (FN-02)", () => {
  it("activa/archiva el Funnel y lo asocia/desasocia de un Agent", async () => {
    const { createFunnel, setStatus, agents, assignFunnel, unassignFunnel, getDetail } = setup();
    const { funnelId } = await createFunnel.execute({ tenantId, name: "Ventas", stages: baseStages });
    await setStatus.execute(funnelId, "active");
    expect((await getDetail.execute(funnelId))?.status).toBe("active");

    await agents.save(
      Agent.create(Identity.of("a1"), {
        tenantId: Identity.of(tenantId),
        name: "Vendedor",
        objective: "vender",
        permanentPrompt: "sé amable",
        policies: [],
        reasoningProfile: "sales-default",
      }),
    );

    await assignFunnel.execute("a1", funnelId);
    expect((await agents.findById(Identity.of("a1")))?.funnelId?.toString()).toBe(funnelId);

    await unassignFunnel.execute("a1");
    expect((await agents.findById(Identity.of("a1")))?.funnelId).toBeUndefined();
  });
});
