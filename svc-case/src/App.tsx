import { SmartPage, type SmartPageConfig, type SmartDialogValueHelpConfig, get, post, patch, extractRows } from "@create.nine/fast-ui";

const caseTypeOptions = extractRows<any>(
  await get(
    "/sap/c4c/api/v1/case-type-service/caseTypes?$filter=templateStatus%20eq%20ACTIVE",
  ),
).map((r) => ({
  label: r.description || r.code,
  value: r.code,
}));

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
    onCellEdit: async (rowId, columnId, newValue, oldValue, row) => {
      if (columnId !== "subject" && columnId !== "priority") return;
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

function buildCaseDetail(c: any): SmartPageConfig {
  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString() : "-";

  const customer = c.individualCustomer;
  return {
    layout: "tabs",
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
    },
    sections: [
      {
        key: "generalInfo",
        title: "General Information",
        content: {
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
    ],

  };

}

export default function App() {
  return <SmartPage config={caseConfig} />;
}
