import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OpenAIReasoningProvider,
  ReasoningBackedDecisionEngine,
  SupabaseAppointmentRepository,
  SupabaseAppointmentTimelineRepository,
  SupabaseCalendarRepository,
  SupabaseChannelBindingResolver,
  SupabaseCustomerRepository,
  SupabaseCustomerTimelineRepository,
  SupabaseLeadRepository,
  SupabaseReportsRepository,
  SystemClock,
  UuidIdGenerator,
  WhatsAppMessageSender,
} from "@/infrastructure";
import {
  SupabaseAgentRepository,
  SupabaseConversationRepository,
  SupabaseDecisionRepository,
  SupabaseEventRepository,
  SupabaseFunnelRepository,
  SupabaseSessionRepository,
  SupabaseTenantRepository,
} from "@/infrastructure/supabase/repositories";
import {
  ArchiveCustomer,
  CreateAppointment,
  CreateCalendar,
  CreateCustomer,
  DeleteAppointment,
  ExecuteDecision,
  GetAppointmentDetail,
  GetAppointmentMetrics,
  GetConversationDetail,
  GetConversationMetrics,
  GetCustomerDetail,
  GetCustomerMetrics,
  GetDashboardKpis,
  HandleInboundMessage,
  IngestEvent,
  ListAppointments,
  ListCalendars,
  ListConversationMessages,
  ListCustomers,
  MakeDecision,
  RescheduleAppointment,
  SendOperatorMessage,
  SetAppointmentStatus,
  SetOperatorControl,
  StartConversation,
  UpdateCustomer,
  UpdateCustomerTags,
  UpdateLead,
} from "@/application/use-cases";
import type {
  ExecutionContext,
  IDecisionEngine,
  MessageSender,
} from "@/application/ports";

/**
 * Composition Root de la capa `app`: ensambla los casos de uso con sus
 * adaptadores concretos a partir de un `SupabaseClient` con alcance de request
 * (creado por `createServerSupabase`). Aquí —y solo aquí— el dominio se conecta
 * con la infraestructura; las capas internas nunca conocen estas clases.
 */
export interface Container {
  startConversation: StartConversation;
  ingestEvent: IngestEvent;
  makeDecision: MakeDecision;
  executeDecision: ExecuteDecision;
  handleInboundMessage: HandleInboundMessage;
  getConversationDetail: GetConversationDetail;
  listConversationMessages: ListConversationMessages;
  setOperatorControl: SetOperatorControl;
  sendOperatorMessage: SendOperatorMessage;
  createCustomer: CreateCustomer;
  updateCustomer: UpdateCustomer;
  archiveCustomer: ArchiveCustomer;
  getCustomerDetail: GetCustomerDetail;
  listCustomers: ListCustomers;
  updateLead: UpdateLead;
  updateCustomerTags: UpdateCustomerTags;
  createCalendar: CreateCalendar;
  listCalendars: ListCalendars;
  createAppointment: CreateAppointment;
  getAppointmentDetail: GetAppointmentDetail;
  listAppointments: ListAppointments;
  setAppointmentStatus: SetAppointmentStatus;
  rescheduleAppointment: RescheduleAppointment;
  deleteAppointment: DeleteAppointment;
  getDashboardKpis: GetDashboardKpis;
  getCustomerMetrics: GetCustomerMetrics;
  getAppointmentMetrics: GetAppointmentMetrics;
  getConversationMetrics: GetConversationMetrics;
}

export interface ContainerOptions {
  /**
   * Permite inyectar un Decision Engine (p. ej. determinista en tests). Si se
   * omite, se usa el engine respaldado por razonamiento OpenAI, construido de
   * forma perezosa (AA-02: el origen de la decisión es intercambiable).
   */
  decisionEngine?: IDecisionEngine;
  /** Permite inyectar un sender falso en tests; por defecto WhatsApp Cloud API. */
  messageSender?: MessageSender;
}

export function createContainer(db: SupabaseClient, options: ContainerOptions = {}): Container {
  const ids = new UuidIdGenerator();
  const clock = new SystemClock();

  const tenants = new SupabaseTenantRepository(db);
  const agents = new SupabaseAgentRepository(db);
  const funnels = new SupabaseFunnelRepository(db);
  const conversations = new SupabaseConversationRepository(db);
  const sessions = new SupabaseSessionRepository(db);
  const events = new SupabaseEventRepository(db);
  const decisions = new SupabaseDecisionRepository(db);
  void tenants; // disponible para casos de uso de aprovisionamiento (pendientes).

  // El proveedor OpenAI exige OPENAI_API_KEY; se construye solo al primer
  // `decide` para que montar el container no dependa de esa clave.
  const engine =
    options.decisionEngine ??
    lazyDecisionEngine(
      () => new ReasoningBackedDecisionEngine(new OpenAIReasoningProvider(), ids),
    );

  const bindings = new SupabaseChannelBindingResolver(db);
  const sender = options.messageSender ?? new WhatsAppMessageSender();

  const customers = new SupabaseCustomerRepository(db);
  const leads = new SupabaseLeadRepository(db);
  const customerTimeline = new SupabaseCustomerTimelineRepository(db);

  const calendars = new SupabaseCalendarRepository(db);
  const appointments = new SupabaseAppointmentRepository(db);
  const appointmentTimeline = new SupabaseAppointmentTimelineRepository(db);
  const reports = new SupabaseReportsRepository(db);

  const startConversation = new StartConversation(ids, clock, conversations, sessions);
  const ingestEvent = new IngestEvent(ids, clock, sessions, events);
  const makeDecision = new MakeDecision(engine, events, sessions, agents, funnels, decisions);
  const executeDecision = new ExecuteDecision(ids, clock, decisions, events, sender);

  return {
    startConversation,
    ingestEvent,
    makeDecision,
    executeDecision,
    handleInboundMessage: new HandleInboundMessage(
      bindings,
      conversations,
      sessions,
      ids,
      clock,
      startConversation,
      ingestEvent,
      makeDecision,
      executeDecision,
    ),
    getConversationDetail: new GetConversationDetail(conversations, sessions),
    listConversationMessages: new ListConversationMessages(
      conversations,
      sessions,
      events,
    ),
    setOperatorControl: new SetOperatorControl(sessions),
    sendOperatorMessage: new SendOperatorMessage(
      ids,
      conversations,
      sessions,
      bindings,
      ingestEvent,
      decisions,
      executeDecision,
    ),
    createCustomer: new CreateCustomer(ids, clock, customers, leads, customerTimeline),
    updateCustomer: new UpdateCustomer(ids, clock, customers, customerTimeline),
    archiveCustomer: new ArchiveCustomer(ids, clock, customers, customerTimeline),
    getCustomerDetail: new GetCustomerDetail(customers, leads, customerTimeline),
    listCustomers: new ListCustomers(customers),
    updateLead: new UpdateLead(ids, clock, leads, customerTimeline),
    updateCustomerTags: new UpdateCustomerTags(ids, clock, customers, customerTimeline),
    createCalendar: new CreateCalendar(ids, calendars),
    listCalendars: new ListCalendars(calendars),
    createAppointment: new CreateAppointment(
      ids,
      clock,
      calendars,
      appointments,
      appointmentTimeline,
      customerTimeline,
    ),
    getAppointmentDetail: new GetAppointmentDetail(appointments, appointmentTimeline),
    listAppointments: new ListAppointments(appointments),
    setAppointmentStatus: new SetAppointmentStatus(ids, clock, appointments, appointmentTimeline),
    rescheduleAppointment: new RescheduleAppointment(ids, clock, appointments, appointmentTimeline),
    deleteAppointment: new DeleteAppointment(ids, clock, appointments, appointmentTimeline),
    getDashboardKpis: new GetDashboardKpis(reports),
    getCustomerMetrics: new GetCustomerMetrics(reports),
    getAppointmentMetrics: new GetAppointmentMetrics(reports),
    getConversationMetrics: new GetConversationMetrics(reports),
  };
}

/** Envuelve un IDecisionEngine cuya construcción se difiere al primer `decide`. */
function lazyDecisionEngine(factory: () => IDecisionEngine): IDecisionEngine {
  let inner: IDecisionEngine | undefined;
  return {
    decide(context: ExecutionContext) {
      inner ??= factory();
      return inner.decide(context);
    },
  };
}
