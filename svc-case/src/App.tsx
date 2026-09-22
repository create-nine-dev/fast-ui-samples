/**
 * Demo app: case management UI backed by the SAP Service Cloud APIs,
 * rendered declaratively via fast-ui SmartPage configs (list view + detail view + create wizard).
 */
import { SmartPage, type SmartPageConfig, type SmartDialogValueHelpConfig, get, post, patch, extractRows } from "@create.nine/fast-ui";

// Active case types are loaded once at startup and shared between the
// table column.
const caseTypeOptions = extractRows<any>(
  await get(
    "/sap/c4c/api/v1/case-type-service/caseTypes?$filter=templateStatus%20eq%20ACTIVE",
  ),
).map((r) => ({
  label: r.description || r.code,
  value: r.code,
}));

// Reusable picker dialog for assigning a customer (individual customer / business partner)
// to a case. Used by both the table's value-help column and the create wizard.
const customerValueHelp: SmartDialogValueHelpConfig = {
  keyField: "displayId",
  displayField: "formattedName",
  title: "Select Customer",
  searchOnOpen: true,
  config: {
    entity: [
      {
        key: "displayId",
        label: "Business Partner ID",
        filterOperator: "eq",
      },
      {
        key: "formattedName",
        label: "Name",
        filterOperator: "startswith",
      },
      {
        key: "defaultAddress.formattedPostalAddressDescription",
        label: "Address",
      },
    ],
    dataSource: {
      endpoint:
        "/sap/c4c/api/v1/individual-customer-service/individualCustomers",
    },
    table: {
      search: {
        placeholder: "Search Customers",
      },
      display: { title: "Customers" },
      columns: [
        "displayId",
        "formattedName",
        "defaultAddress.formattedPostalAddressDescription",
      ],
      pagination: { pageSize: 10 },
    },
    filterBar: {
      fields: ["formattedName", "displayId"],
    },
  },
};


const caseConfig: SmartPageConfig = {
  table: {
    entity: [
      { key: "id", label: "ID" },
      { key: "displayId", label: "Display ID", filterOperator: "eq" },
      { key: "subject", label: "Subject", editable: true },
      // { key: "priorityDescription", label: "Priority" },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        editable: true,
        options: [
          { label: "Immediate", value: "01" },
          { label: "Urgent", value: "02" },
          { label: "Normal", value: "03" },
          { label: "Low", value: "04" },
        ],
      },
      { key: "caseTypeDescription", label: "Case Type" },
      {
        key: "caseType",
        label: "Case Type",
        type: "select",
        options: caseTypeOptions,
      },
      { key: "statusDescription", label: "Status" },
      { key: "individualCustomer.name", label: "Customer Name" },
      {
        key: "individualCustomer.displayId",
        label: "Customer",
        type: "valueHelp",
        valueHelp: customerValueHelp,
      },
    ],
    dataSource: {
      endpoint:
        "/sap/c4c/api/v1/case-service/cases?$orderby=adminData/updatedOn desc",
    },
    table: {
      display: {
        title: "Cases",
        pattern: "striped",
        cardLayout: {
          enabled: false,
          toggleEnabled: true,
        },
      },
      columns: [
        "displayId",
        "subject",
        "individualCustomer.name",
        "caseTypeDescription",
        "statusDescription",
        "priority",
      ],
      toolbar: [
        {
          key: "createCase",
          icon: "add",
          iconOnly: true,
          dialog: "createCaseDialog",
        },
      ],
      navigation: {
        fetchDetail: async (id) => {
          const res = await get<any>(
            `/sap/c4c/api/v1/case-service/cases/${id}`,
          );
          // C4C OData responses vary in shape depending on the endpoint
          // (plain array, { value: [...] }, or v2-style { d: { results: [...] } }),
          // so normalize to a single case object before building the detail page.
          const c = Array.isArray(res)
            ? res[0]
            : Array.isArray(res?.value)
              ? res.value[0]
              : res?.value && typeof res.value === "object"
                ? res.value
                : (res?.d?.results?.[0] ?? res);
          return buildCaseDetail(c);
        },
      },
      dataWorkbench: {
        columnPickerEnabled: true,
      },
    },
    filterBar: {
      variant: "modern",
      fields: ["displayId", "caseType", "individualCustomer.displayId"],
    },
    onCellEdit: async (_rowId, columnId, newValue, _oldValue, row) => {
      if (columnId !== "subject" && columnId !== "priority") return;
      // Send the last-updated timestamp as If-Match so concurrent edits fail
      // with a 412 instead of silently overwriting each other (optimistic locking).
      const updatedOn = row.adminData?.updatedOn;
      await patch(
        `/sap/c4c/api/v1/case-service/cases/${row.id}`,
        { [columnId]: newValue },
        { headers: { "If-Match": updatedOn } },
      );
    },
    dialogs: {
      createCaseDialog: {
        title: "Create Case",
        size: "medium",
        content: {
          type: "wizard",
          wizard: {
            steps: [
              {
                key: "details",
                title: "Case Details",
                description: "Case type, subject and customer",
                sections: [
                  {
                    columns: 1,
                    fields: [
                      {
                        key: "caseType",
                        label: "Case Type",
                        type: "select",
                        required: true,
                        options: caseTypeOptions,
                      },
                      {
                        key: "subject",
                        label: "Subject",
                        type: "text",
                        required: true,
                      },
                      {
                        key: "customer",
                        label: "Customer",
                        type: "valueHelp",
                        required: true,
                        valueHelp: customerValueHelp,
                      },
                    ],
                  },
                ],
              },
              {
                key: "classification",
                title: "Classification",
                description: "Priority, reported on and source",
                sections: [
                  {
                    columns: 1,
                    fields: [
                      {
                        key: "priority",
                        label: "Priority",
                        type: "select",
                        required: true,
                        options: [
                          { label: "Immediate", value: "01" },
                          { label: "Urgent", value: "02" },
                          { label: "Normal", value: "03" },
                          { label: "Low", value: "04" },
                        ],
                        defaultValue: "03",
                      },
                      { key: "origin", label: "Source" },
                      {
                        key: "reportedOn",
                        label: "Reported On",
                        type: "date",
                        required: true,
                        defaultValue: new Date().toISOString().slice(0, 10),
                      },
                    ],
                  },
                ],
              },
              {
                key: "confirm",
                title: "Confirmation",
                description: "Review and confirm",
                sections: [{ fields: [] }], // auto-summary of all entered values
              },
            ],
            onFinish: async (values) => {
              // Shape the wizard values into the C4C case-service POST payload.
              const payload = {
                caseType: values.caseType,
                subject: values.subject,
                priority: values.priority,
                origin: values.origin,
                timePoints: {
                  reportedOn: values.reportedOn
                    ? new Date(values.reportedOn).toISOString()
                    : undefined,
                },
                individualCustomer: { displayId: values.customer },
              };
              await post("/sap/c4c/api/v1/case-service/cases", payload);
            },
            message: {
              success: "Case created",
              error: "Failed to create case",
            },
          },
        },
      },
    },
  },
};

// Builds the case detail page (header + tabs with timeline and customer info)
// from a single case object returned by fetchDetail.
function buildCaseDetail(c: any): SmartPageConfig {
  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString() : "-";

  // Extract external IDs for related entities so we can batch-fetch them
  // in a single request per entity type below.
  const caIds = c.contractAccounts?.map((ca: any) => ca.externalId) || [];
  const premiseIds = c.premises?.map((p: any) => p.externalId) || [];

  const customer = c.individualCustomer;
  return {
    layout: "tabs",
    // Object-page-style header: title/subtitle, a priority status pill,
    // metadata + metric cards, and an escalation banner only when escalated.
    header: {
      showBack: true,
      avatarIcon: "briefcase",
      title: c.subject || "Case",
      subtitle: `${c.displayId} · ${c.caseTypeDescription || ""}`,
      status: [{ label: c.priorityDescription || c.priority, color: "info" }],
      metadata: [
        { label: "Origin", value: c.originDescription || c.origin },
        { label: "Reported On", value: fmtDate(c.timePoints?.reportedOn) },
        { label: "Reported By", value: c.reporter?.name },
      ],
      metrics: [
        { label: "Status", value: c.statusDescription, icon: "info" },
        { label: "Customer", value: customer?.name, icon: "user" },
        { label: "Processor", value: c.processor?.name, icon: "user" },
      ],

      alerts:
        c.escalationStatus === "ESCALATED"
          ? [{ label: "This Case Has Been Escalated", color: "error" }]
          : undefined,

      // Header actions for escalating / de-escalating the case.
      // Both use optimistic locking and refresh the detail page on success.
      actions: [
        {
          // Disabled when already escalated to prevent duplicate actions.
          key: "escalate", label: "Escalate", icon: "alert-triangle", disabled: c.escalationStatus === "ESCALATED" ? true : false,
          confirm: {
            title: "Escalate Case",
            description: "Are you sure you want to escalate this case?",
            variant: "destructive",
            confirmLabel: "Escalate",
            cancelLabel: "Cancel"
          },
          refresh: true,
          message: { success: "Case Escalate Successfully", error: "Failed to Escalate Case" },
          onClick: async () => {
            const updatedOn = c.adminData?.updatedOn;
            await patch(
              `/sap/c4c/api/v1/case-service/cases/${c.id}`,
              { escalationStatus: "ESCALATED" },
              { headers: { "If-Match": updatedOn } },
            );
          }
        },
        {
          // Only enabled when the case is currently escalated.
          key: "deEscalate", label: "De-Escalate", disabled: c.escalationStatus !== "ESCALATED" ? true : false,
          confirm: {
            title: "De-Escalate Case",
            description: "Are you sure you want to De-Escalate this case?",
            confirmLabel: "De-Escalate",
            cancelLabel: "Cancel"
          },
          refresh: true,
          message: { success: "Case De-Escalated Successfully", error: "Failed to De-Escalate Case" },
          onClick: async () => {
            const updatedOn = c.adminData?.updatedOn;
            await patch(
              `/sap/c4c/api/v1/case-service/cases/${c.id}`,
              { escalationStatus: "NOT_ESCALATED" },
              { headers: { "If-Match": updatedOn } },
            );
          }
        },
      ]
    },
    sections: [
      {
        key: "generalInfo",
        title: "General Information",
        content: {
          // Side-by-side panes: timeline on the left (60%), customer
          // details on the right (40%). Each pane fetches its own data.
          type: "split",
          direction: "horizontal",
          sizes: [60, 40],
          items: [
            {
              type: "list",
              list: {
                title: "Case Timeline",
                variant: "timeline",
                items: [],
              },
              dataSource: {
                fetcher: async () => {
                  // Timeline events live in a shared service; filter to this case
                  // via sourceObjectId + subscriberCode.
                  const json = await get<any>(
                    `/sap/c4c/api/v1/timeline-service/timelineEvents` +
                    `?$top=50&$skip=0&$filter=(sourceObjectId%20eq%20'${c.id}')` +
                    `&subscriberCode=CASE`,
                  );
                  return extractRows<any>(json).map((e) => ({
                    key: e.id,
                    date: fmtDate(e.timestamp),
                    title: e.subject?.content || "",
                    description: e.description?.content || "",
                    status: "success",
                    fields: [],
                  }));
                },
              },
            },
            {
              type: "list",
              list: { title: "Customer Details", items: [] },
              dataSource: {
                fetcher: async () => {
                  const json = await get<any>(
                    `/sap/c4c/api/v1/individual-customer-service/individualCustomers/${c.individualCustomer.id}` +
                    `?$select=formattedName,displayId,birthDate,defaultAddress,defaultCommunication`,
                  );
                  const cust =
                    json?.responses?.[0]?.value ?? json?.value ?? json ?? {};
                  const addr = cust.defaultAddress ?? {};
                  const comm = cust.defaultCommunication ?? {};
                  return [
                    {
                      key: "cust-details",
                      fields: [
                        { label: "Name", value: cust.formattedName ?? "" },
                        { label: "Customer ID", value: cust.displayId ?? "" },
                        {
                          label: "Address",
                          value: addr.formattedPostalAddressDescription ?? "",
                        },
                        {
                          label: "BirthDate",
                          value: cust.birthDate ?? "",
                        },
                        {
                          label: "Mobile",
                          value: comm.mobileFormattedNumber ?? "",
                        },
                      ],
                    },
                  ];
                },
              },
            },
          ],
        },
      },

      {
        // Related entities: contract accounts and premises associated with
        // the case, displayed as card-layout tables in a vertical split.
        key: "relatedEntities",
        title: "Related Entities",
        content: {
          type: "split",
          direction: "vertical",
          sizes: ["50%", "50%"],
          items: [
            {
              type: "table",
              table: {
                entity: [
                  { key: "id" },
                  { key: "externalReferenceId", label: "External Id" },
                  { key: "accountDeterminationIdDescription", label: "Account Determination" },
                  { key: "customerInfo.name", label: "Customer" },
                ],
                dataSource: {
                  // Batch-fetch contract accounts whose external IDs match
                  // the case's linked contract account references.
                  fetcher: async () => {
                    if (caIds.length === 0) return [];
                    const filter = caIds
                      .map((id: string) => `externalReferenceId eq '${id}'`)
                      .join(" or ");
                    const url = `/sap/c4c/api/v1/contract-account-service/contractAccount?$filter=${encodeURIComponent(filter)}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    return data.value || [];
                  },
                },
                table: {
                  display: {
                    title: "Contract Accounts",
                    cardLayout: {
                      enabled: true,
                      columns: 3,
                    },
                  },
                  columns: ["externalReferenceId", "accountDeterminationIdDescription", "customerInfo.name"],
                  dataWorkbench: {
                    refreshEnabled: false,
                    exportEnabled: false,
                  },
                  pagination: {
                    enabled: false,
                  },
                },
                filterBar: {
                  hideFilterBar: true,
                },
              },
            },
            {
              type: "table",
              table: {
                entity: [
                  { key: "id" },
                  { key: "externalReferenceId", label: "External Id" },
                  { key: "formattedAddress", label: "Address" },
                ],
                dataSource: {
                  // Batch-fetch premises using the same OData $filter pattern
                  // as contract accounts above.
                  fetcher: async () => {
                    if (premiseIds.length === 0) return [];
                    const filter = premiseIds
                      .map((id: string) => `externalReferenceId eq '${id}'`)
                      .join(" or ");
                    const url = `/sap/c4c/api/v1/premise-service/premise?$filter=${encodeURIComponent(filter)}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    return data.value || [];
                  },
                },
                table: {
                  display: {
                    title: "Premises",
                    cardLayout: {
                      enabled: true,
                      columns: 3,
                    },
                  },
                  columns: ["externalReferenceId", "formattedAddress"],
                  dataWorkbench: {
                    refreshEnabled: false,
                    exportEnabled: false,
                  },
                  pagination: {
                    enabled: false,
                  },
                },
                filterBar: {
                  hideFilterBar: true,
                },
              },
            },
          ],
        },
      },
      {
        // Embedded external application via iframe content type.
        key: "external",
        title: "External App",
        content: [{
          type: "iframe",
          iframe: { src: "https://wikipedia.org", title: "Wikipedia", height: "900px" },
        }],
      },
      {
        // Customer notification preferences: one settings form per communication
        // channel. Toggles inherit the channel default (BP/CA) and are persisted
        // via the tab's submit action.
        key: "accountPreference",
        title: "Account Preferences",
        submit: {
          endpoint: "/api/settings",
          method: "PATCH",
          label: "Save Preferences",
          placement: "top",
        },
        content: [
          {
            type: "form",
            form: {
              mode: "update",
              hideActions: true,
              sections: [
                {
                  title: "Email",
                  description: "Email Preferences",
                  variant: "settings",
                  fields: [
                    {
                      key: "billingandInvoices",
                      label: "Billing and Invoices",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from BP",
                    },
                    {
                      key: "outageAlerts",
                      label: "Outage Alerts (Override)",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from CA",
                    },
                    {
                      key: "paymentReminders",
                      label: "Payment Reminders",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from BP",
                    },
                    {
                      key: "dunningNotices",
                      label: "Dunning Notices",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from BP",
                    },
                    {
                      key: "promotionalOffers",
                      label: "Promotional Offers",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from BP",
                    },
                  ],
                },
              ],
            },
          },
          {
            type: "form",
            form: {
              mode: "update",
              hideActions: true,
              sections: [
                {
                  title: "SMS / Text",
                  description: "SMS and Text Message Preferences",
                  variant: "settings",
                  fields: [
                    {
                      key: "outageAlerts",
                      label: "Outage Alerts",
                      type: "toggle",
                      icon: "mobile",
                      description: "Inherited from BP",
                    },
                    {
                      key: "paymentReminders",
                      label: "Payment Reminders",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from BP",
                    },
                    {
                      key: "billingandInvoices",
                      label: "Billing and Invoices",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from BP",
                    },
                  ],
                },
              ],
            },
          },
          {
            type: "form",
            form: {
              mode: "update",
              hideActions: true,
              sections: [
                {
                  title: "Paper / Post",
                  description: "Paper and Post Message Preferences",
                  variant: "settings",
                  fields: [
                    {
                      key: "billingandInvoices",
                      label: "Billing and Invoices",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from BP",
                    },
                    {
                      key: "dunningNotices",
                      label: "Dunning Notices",
                      type: "toggle",
                      icon: "mail",
                      description: "Inherited from BP",
                    },
                  ],
                },
              ],
            },
          },
          {
            type: "text",
            fullWidth: true,
            text: {
              variant: "warning",
              title:
                "Notification Preferences",
              content: `Notification preferences determine how customers receive service updates
Preferences can be updated at any time through the customer portal`,
            },
          },
        ],
      },
      {
        // Full audit trail for this case. The change-history service stores
        // several field-level changes in a single record, so each record's
        // changeItems are flattened into one table row per field change.
        key: "changeHistory",
        title: "Change History",
        content: [
          {
            type: "table",
            table: {
              dataSource: {
                endpoint: "/sap/c4c/api/v1/change-history-service/changes",
                fetcher: async (endpoint, top, skip) => {
                  // Restrict the shared change-history service to this case's
                  // service + object, then unpack every field change into a row.
                  const filter = encodeURIComponent(
                    "(service eq 'sap.crm.service.caseService') and (storageType eq 'HOT') " +
                    `and (objectId eq '${c.id}')`,
                  );
                  const json = await get<any>(
                    `${endpoint}?$filter=${filter}&$top=${top}&$skip=${skip}`,
                  );
                  const rows: any[] = [];
                  for (const rec of json?.value ?? []) {
                    for (const item of rec.changeItems ?? []) {
                      rows.push({
                        id: `${rec.id}-${item.path}-${item.element}`,
                        changedDate: (rec.changeDateTime ?? "").slice(0, 10),
                        changedOn: rec.changeDateTime,
                        changedBy: rec.userDisplayName,
                        modification: rec.modification,
                        field: item.pathElementDisplayName,
                        oldValue: item.oldDisplayValue ?? item.oldValue ?? "",
                        newValue: item.newDisplayValue ?? item.newValue ?? "",
                      });
                    }
                  }
                  return rows;
                },
              },

              entity: [
                {
                  key: "changedDate",
                  label: "Changed On",
                  type: "date"
                },
                { key: "changedOn", label: "Changed On", type: "date" },
                { key: "changedBy", label: "Changed By", type: "text" },
                {
                  key: "modification",
                  label: "Modification",
                  type: "text"
                },
                { key: "field", label: "Field", type: "text" },
                { key: "oldValue", label: "Old Value", type: "text" },
                { key: "newValue", label: "New Value", type: "text" },
              ],
              table: {
                display: {
                  title: "Case Change History",
                  showRecordCount: true,
                },
                grouping: {
                  enabled: true,
                  column: "changedDate",
                  expanded: true,
                  label: "{changedDate} {changedBy}",
                },
                columns: [
                  "changedDate",
                  "modification",
                  "field",
                  "oldValue",
                  "newValue",
                ],
              },
              filterBar: {
                hideFilterBar: true,
              },
            },
          },

        ],
      },
    ],

  };

}

export default function App() {
  return <SmartPage config={caseConfig} />;
}
