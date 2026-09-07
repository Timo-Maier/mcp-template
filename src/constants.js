'use strict';

const SERVICES = {
  product: {
    description: 'SAP S/4HANA Product Master API — manage and query product master data.',
    destination: 'S4_QAS',
    path: '/sap/opu/odata4/sap/api_product/srvd_a2x/sap/product/0002',
  },
  "product-classification": {
    description: 'Read the master data for products including class assignment and characteristic evaluation',
    destination: 'S4_QAS',
    path: '/sap/opu/odata/sap/API_CLFN_PRODUCT_SRV'
  },
  "document-info-records": {
    description: 'Read info for document info records',
    destination: 'S4_QAS',
    path: '/sap/opu/odata/sap/API_DMS_PROCESS_SRV'
  }
};

module.exports = { SERVICES };
