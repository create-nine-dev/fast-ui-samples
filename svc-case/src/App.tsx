import { SmartPage, type SmartPageConfig } from "@create.nine/fast-ui";

const caseConfig: SmartPageConfig = {
  table: {
    entity: [
      { key: "id", label: "ID" },
      { key: "displayId", label: "Display ID", filterOperator: "eq" },
      { key: "subject", label: "Subject" },
      { key: "priorityDescription", label: "Priority" },
      { key: "caseTypeDescription", label: "Case Type" },
      { key: "statusDescription", label: "Status" },
      { key: "individualCustomer.name", label: "Customer Name" },
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
      dataWorkbench: {
        columnPickerEnabled: true,
      },
    },
    filterBar: {
      variant: "modern",
    },
  },
};

export default function App() {
  return <SmartPage config={caseConfig} />;
}
