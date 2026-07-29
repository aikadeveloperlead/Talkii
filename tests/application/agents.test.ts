import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain";
import {
  CreateAgent,
  DuplicateAgent,
  GetAgentDetail,
  ListAgents,
  SetAgentStatus,
  UpdateAgent,
} from "@/application/use-cases";
import { InMemoryAgents, SequentialIds } from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

function setup() {
  const ids = new SequentialIds();
  const agents = new InMemoryAgents();
  return {
    agents,
    createAgent: new CreateAgent(ids, agents),
    updateAgent: new UpdateAgent(agents),
    setStatus: new SetAgentStatus(agents),
    duplicateAgent: new DuplicateAgent(ids, agents),
    getDetail: new GetAgentDetail(agents),
    listAgents: new ListAgents(agents),
  };
}

const baseInput = {
  tenantId,
  name: "Ventas",
  role: "Vendedor",
  objective: "calificar leads",
  permanentPrompt: "sé amable",
  reasoningProfile: "sales-default",
};

describe("CreateAgent (SCR-008 — BK-02 nombre único por Tenant)", () => {
  it("crea el Agent en estado draft", async () => {
    const { createAgent, getDetail } = setup();
    const { agentId } = await createAgent.execute(baseInput);
    const detail = await getDetail.execute(agentId);
    expect(detail?.status).toBe("draft");
    expect(detail?.role).toBe("Vendedor");
  });

  it("rechaza nombre duplicado en el mismo Tenant", async () => {
    const { createAgent } = setup();
    await createAgent.execute(baseInput);
    await expect(createAgent.execute(baseInput)).rejects.toThrow(DomainError);
  });
});

describe("UpdateAgent / SetAgentStatus / DuplicateAgent", () => {
  it("actualiza campos y valida unicidad de nombre al renombrar", async () => {
    const { createAgent, updateAgent, getDetail } = setup();
    const { agentId } = await createAgent.execute(baseInput);

    await updateAgent.execute({ agentId, personality: "cercana y directa" });
    expect((await getDetail.execute(agentId))?.personality).toBe("cercana y directa");
  });

  it("cambia de estado (BK-03) sin eliminar físicamente (BK-04)", async () => {
    const { createAgent, setStatus, getDetail } = setup();
    const { agentId } = await createAgent.execute(baseInput);

    await setStatus.execute(agentId, "active");
    expect((await getDetail.execute(agentId))?.status).toBe("active");

    await setStatus.execute(agentId, "archived");
    expect((await getDetail.execute(agentId))?.status).toBe("archived");
    expect(await getDetail.execute(agentId)).not.toBeNull(); // sigue existiendo
  });

  it("duplica con nombre único derivado y status draft", async () => {
    const { createAgent, duplicateAgent, listAgents } = setup();
    const { agentId } = await createAgent.execute(baseInput);

    const { agentId: copyId } = await duplicateAgent.execute(agentId);
    expect(copyId).not.toBe(agentId);

    const list = await listAgents.execute(tenantId);
    expect(list).toHaveLength(2);
    expect(list.find((a) => a.id === copyId)?.name).toBe("Ventas (copia)");
  });
});
