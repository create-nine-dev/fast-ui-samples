import { SmartPage, type SmartPageConfig, type SmartDialogValueHelpConfig, get, post, extractRows } from "@create.nine/fast-ui";

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
      { key: "subject", label: "Subject" },
      { key: "priorityDescription", label: "Priority" },
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
        "priorityDescription",
      ],
      toolbar: [
        {
          key: "createCase",
          icon: "add",
          iconOnly: true,
          dialog: "createCaseDialog",
        },
      ],
      dataWorkbench: {
        columnPickerEnabled: true,
      },
    },
    filterBar: {
      variant: "modern",
      fields: ["displayId", "caseType", "individualCustomer.displayId"],
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

export default function App() {
  return <SmartPage config={caseConfig} />;
}
