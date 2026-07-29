import { describe, expect, it } from "vitest";
import { Agent, DomainError, Identity } from "@/domain";
import {
  ArchiveKnowledgeDocument,
  CreateCategory,
  CreateKnowledgeDocument,
  GetKnowledgeDetail,
  LinkAgentKnowledge,
  ListCategories,
  ListKnowledgeDocuments,
  UnlinkAgentKnowledge,
  UpdateKnowledgeDocument,
} from "@/application/use-cases";
import {
  InMemoryAgentKnowledge,
  InMemoryAgents,
  InMemoryCategories,
  InMemoryKnowledge,
  SequentialIds,
} from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

function setup() {
  const ids = new SequentialIds();
  const categories = new InMemoryCategories();
  const knowledge = new InMemoryKnowledge();
  const agents = new InMemoryAgents();
  const agentKnowledge = new InMemoryAgentKnowledge();
  return {
    categories,
    knowledge,
    agents,
    agentKnowledge,
    createCategory: new CreateCategory(ids, categories),
    listCategories: new ListCategories(categories),
    createDoc: new CreateKnowledgeDocument(ids, knowledge),
    updateDoc: new UpdateKnowledgeDocument(knowledge),
    archiveDoc: new ArchiveKnowledgeDocument(knowledge),
    getDetail: new GetKnowledgeDetail(knowledge),
    listDocs: new ListKnowledgeDocuments(knowledge),
    linkAgentKnowledge: new LinkAgentKnowledge(agents, knowledge, agentKnowledge),
    unlinkAgentKnowledge: new UnlinkAgentKnowledge(agentKnowledge),
  };
}

describe("CreateKnowledgeDocument / UpdateKnowledgeDocument (SCR-009 BK-01/BK-03)", () => {
  it("nace en estado pending, y editar lo regresa a pending", async () => {
    const { createDoc, updateDoc, getDetail } = setup();
    const { knowledgeId } = await createDoc.execute({
      tenantId,
      title: "FAQ",
      content: "Preguntas frecuentes",
      sourceType: "text",
    });
    expect((await getDetail.execute(knowledgeId))?.status).toBe("pending");

    await updateDoc.execute({ knowledgeId, content: "Preguntas frecuentes v2" });
    const detail = await getDetail.execute(knowledgeId);
    expect(detail?.status).toBe("pending");
    expect(detail?.content).toBe("Preguntas frecuentes v2");
  });

  it("archivar es eliminación lógica (BK-04): sigue existiendo pero inactivo", async () => {
    const { createDoc, archiveDoc, getDetail, listDocs } = setup();
    const { knowledgeId } = await createDoc.execute({
      tenantId,
      title: "FAQ",
      content: "x",
      sourceType: "text",
    });

    await archiveDoc.execute(knowledgeId);
    const detail = await getDetail.execute(knowledgeId);
    expect(detail?.status).toBe("archived");
    expect(detail?.isActive).toBe(false);
    expect(await listDocs.execute(tenantId)).toHaveLength(0); // excluido del listado activo
  });
});

describe("CreateCategory / ListCategories", () => {
  it("crea y lista categorías del Tenant", async () => {
    const { createCategory, listCategories } = setup();
    await createCategory.execute({ tenantId, name: "Ventas", color: "#00ff00" });
    expect(await listCategories.execute(tenantId)).toHaveLength(1);
  });
});

describe("LinkAgentKnowledge / UnlinkAgentKnowledge (BK-05: N:N)", () => {
  it("asocia y desasocia un documento con un Agent", async () => {
    const { createDoc, agents, linkAgentKnowledge, unlinkAgentKnowledge, agentKnowledge } = setup();
    await agents.save(
      Agent.create(Identity.of("a1"), {
        tenantId: Identity.of(tenantId),
        name: "Ventas",
        objective: "vender",
        permanentPrompt: "sé amable",
        policies: [],
        reasoningProfile: "sales-default",
      }),
    );
    const { knowledgeId } = await createDoc.execute({
      tenantId,
      title: "FAQ",
      content: "x",
      sourceType: "text",
    });

    await linkAgentKnowledge.execute("a1", knowledgeId);
    expect(await agentKnowledge.listByAgent(Identity.of("a1"))).toHaveLength(1);

    await unlinkAgentKnowledge.execute("a1", knowledgeId);
    expect(await agentKnowledge.listByAgent(Identity.of("a1"))).toHaveLength(0);
  });

  it("falla si el Agent no existe", async () => {
    const { createDoc, linkAgentKnowledge } = setup();
    const { knowledgeId } = await createDoc.execute({
      tenantId,
      title: "FAQ",
      content: "x",
      sourceType: "text",
    });
    await expect(linkAgentKnowledge.execute("no-existe", knowledgeId)).rejects.toThrow(DomainError);
  });
});
