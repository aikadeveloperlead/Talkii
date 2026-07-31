import { describe, expect, it } from "vitest";
import { DomainError, Identity } from "@/domain";
import {
  ArchiveCustomer,
  CreateCustomer,
  GetCustomerDetail,
  ListCustomers,
  UpdateCustomer,
  UpdateCustomerTags,
  UpdateLead,
} from "@/application/use-cases";
import { MAX_LIMIT } from "@/application/use-cases/list-customers";
import {
  FixedClock,
  InMemoryCustomerTimeline,
  InMemoryCustomers,
  InMemoryLeads,
  SequentialIds,
} from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

function setup() {
  const ids = new SequentialIds();
  const clock = new FixedClock();
  const customers = new InMemoryCustomers();
  const leads = new InMemoryLeads();
  const timeline = new InMemoryCustomerTimeline();

  return {
    ids,
    clock,
    customers,
    leads,
    timeline,
    createCustomer: new CreateCustomer(ids, clock, customers, leads, timeline),
    updateCustomer: new UpdateCustomer(ids, clock, customers, timeline),
    archiveCustomer: new ArchiveCustomer(ids, clock, customers, timeline),
    getDetail: new GetCustomerDetail(customers, leads, timeline),
    listCustomers: new ListCustomers(customers),
    updateLead: new UpdateLead(ids, clock, leads, timeline),
    updateTags: new UpdateCustomerTags(ids, clock, customers, timeline),
  };
}

describe("CreateCustomer (SCR-003 — CustomerService.create + Trigger 2)", () => {
  it("crea Customer + Lead inicial (status=new) + timeline.customer.created", async () => {
    const { createCustomer, leads, timeline } = setup();

    const { customerId } = await createCustomer.execute({
      tenantId,
      firstName: "Nicolás",
      phone: "573001112233",
    });

    const lead = await leads.findByCustomerId(Identity.of(customerId));
    expect(lead).not.toBeNull();
    expect(lead?.status).toBe("new");
    expect(lead?.score).toBe(0);

    const entries = await timeline.findByCustomer(Identity.of(customerId));
    expect(entries.map((e) => e.type)).toEqual(["customer.created"]);
  });

  it("rechaza correo inválido", async () => {
    const { createCustomer } = setup();
    await expect(
      createCustomer.execute({
        tenantId,
        firstName: "Nicolás",
        phone: "573001112233",
        email: "no-es-correo",
      }),
    ).rejects.toThrow(DomainError);
  });

  it("rechaza teléfono duplicado en el mismo Tenant", async () => {
    const { createCustomer } = setup();
    await createCustomer.execute({ tenantId, firstName: "A", phone: "573001112233" });
    await expect(
      createCustomer.execute({ tenantId, firstName: "B", phone: "573001112233" }),
    ).rejects.toThrow(DomainError);
  });
});

describe("UpdateCustomer / ArchiveCustomer / GetCustomerDetail", () => {
  it("actualiza el perfil y registra timeline.customer.updated", async () => {
    const { createCustomer, updateCustomer, getDetail } = setup();
    const { customerId } = await createCustomer.execute({
      tenantId,
      firstName: "Nicolás",
      phone: "573001112233",
    });

    await updateCustomer.execute({ customerId, company: "Aika" });

    const detail = await getDetail.execute(customerId);
    expect(detail?.company).toBe("Aika");
    expect(detail?.timeline.map((e) => e.type)).toEqual([
      "customer.created",
      "customer.updated",
    ]);
  });

  it("archiva (soft delete) sin borrar el registro", async () => {
    const { createCustomer, archiveCustomer, getDetail } = setup();
    const { customerId } = await createCustomer.execute({
      tenantId,
      firstName: "Nicolás",
      phone: "573001112233",
    });

    await archiveCustomer.execute(customerId);

    const detail = await getDetail.execute(customerId);
    expect(detail?.archived).toBe(true);
  });

  it("GetCustomerDetail devuelve null si no existe", async () => {
    const { getDetail } = setup();
    expect(await getDetail.execute("no-existe")).toBeNull();
  });
});

describe("ListCustomers", () => {
  it("pagina y filtra por texto, excluye archivados por defecto", async () => {
    const { createCustomer, archiveCustomer, listCustomers } = setup();
    await createCustomer.execute({ tenantId, firstName: "Nicolás", phone: "1" });
    const { customerId: c2 } = await createCustomer.execute({
      tenantId,
      firstName: "Andrea",
      phone: "2",
    });
    await archiveCustomer.execute(c2);

    const result = await listCustomers.execute({ tenantId, query: "nic" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].fullName).toBe("Nicolás");
    expect(result.nextCursor).toBeNull();
  });

  it("pagina por cursor (item MEDIO #12): la segunda página continúa donde terminó la primera", async () => {
    const { createCustomer, listCustomers } = setup();
    await createCustomer.execute({ tenantId, firstName: "Uno", phone: "1" });
    await createCustomer.execute({ tenantId, firstName: "Dos", phone: "2" });
    await createCustomer.execute({ tenantId, firstName: "Tres", phone: "3" });

    const first = await listCustomers.execute({ tenantId, limit: 2 });
    expect(first.items.map((c) => c.fullName)).toEqual(["Tres", "Dos"]);
    expect(first.nextCursor).not.toBeNull();

    const second = await listCustomers.execute({ tenantId, limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((c) => c.fullName)).toEqual(["Uno"]);
    expect(second.nextCursor).toBeNull();
  });

  it("acota el limit del cliente a un techo (hallazgo MEDIUM: ?limit=5000000 volcaba la tabla)", async () => {
    const customers = new InMemoryCustomers();
    let receivedLimit: number | undefined;
    const spy = {
      ...customers,
      search: (
        t: Identity,
        f: Parameters<InMemoryCustomers["search"]>[1],
        c: string | null | undefined,
        limit: number,
      ) => {
        receivedLimit = limit;
        return customers.search(t, f, c, limit);
      },
    } as unknown as InMemoryCustomers;

    await new ListCustomers(spy).execute({ tenantId, limit: 5_000_000 });

    expect(receivedLimit).toBe(MAX_LIMIT);
  });
});

describe("UpdateLead (SCR-003 §7 PATCH /customers/:id/lead)", () => {
  it("actualiza status y score, registra timeline.lead.updated", async () => {
    const { createCustomer, updateLead, getDetail } = setup();
    const { customerId } = await createCustomer.execute({
      tenantId,
      firstName: "Nicolás",
      phone: "573001112233",
    });

    await updateLead.execute({ customerId, status: "qualified", score: 80 });

    const detail = await getDetail.execute(customerId);
    expect(detail?.lead).toMatchObject({ status: "qualified", score: 80 });
    expect(detail?.timeline.at(-1)?.type).toBe("lead.updated");
  });

  it("falla si el Customer no tiene Lead asociado", async () => {
    const { updateLead } = setup();
    await expect(
      updateLead.execute({ customerId: "no-existe", status: "won" }),
    ).rejects.toThrow(DomainError);
  });
});

describe("UpdateCustomerTags (SCR-003 §5 TagAdded/TagRemoved)", () => {
  it("registra un evento de timeline por cada etiqueta añadida/quitada", async () => {
    const { createCustomer, updateTags, getDetail } = setup();
    const { customerId } = await createCustomer.execute({
      tenantId,
      firstName: "Nicolás",
      phone: "573001112233",
    });

    await updateTags.execute({ customerId, tags: ["vip", "demo"] });
    await updateTags.execute({ customerId, tags: ["vip"] });

    const detail = await getDetail.execute(customerId);
    expect(detail?.tags).toEqual(["vip"]);
    expect(detail?.timeline.map((e) => e.type)).toEqual([
      "customer.created",
      "tag.added",
      "tag.added",
      "tag.removed",
    ]);
  });
});
