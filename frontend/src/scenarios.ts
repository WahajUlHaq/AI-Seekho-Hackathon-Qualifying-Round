import type { PipelineRequest } from "./types";

export interface Scenario {
  id: string;
  label: string;
  description: string;
  icon: string;
  request: PipelineRequest;
}

const DEFAULT_CONSTRAINTS: PipelineRequest["constraints"] = {
  budget_limit: { amount: 500000, currency: "PKR" },
  time_limit_hours: 24,
  urgency: "high",
};

export const SCENARIOS: Scenario[] = [
  {
    id: "critical-shortage",
    label: "Critical Inventory Shortage",
    icon: "🚨",
    description: "45-unit stockout with transport strike and demand spike. Core test case.",
    request: {
      constraints: DEFAULT_CONSTRAINTS,
      sources: [
        {
          source_id: "SRC-001", source_type: "pdf",
          content: "WAREHOUSE INVENTORY REPORT\nDate: 2026-05-15T09:00:00Z\nFacility: Warehouse A, Karachi\nProduct: SKU-1234 (Premium Widget)\nCurrent Stock Count: 45 units\nStatus: CRITICAL - SHORTAGE\nReorder Point: 200 units\nDays Until Stockout: 2 days at current demand\nNext Delivery: 2026-05-20 (delayed due to transport strike)",
          metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "official_report" },
        },
        {
          source_id: "SRC-002", source_type: "csv",
          content: "date,product_sku,orders,demand_change_pct,revenue_pkr\n2026-05-15,SKU-1234,180,38,900000\n2026-05-14,SKU-1234,130,30,650000\n2026-05-13,SKU-1234,100,0,500000\n2026-05-12,SKU-1234,98,-2,490000",
          metadata: { timestamp: "2026-05-15T12:00:00Z", authority_type: "analytics_platform" },
        },
        {
          source_id: "SRC-003", source_type: "json",
          content: '{"from":"supplier@xyzlogistics.com","subject":"Critical Delivery Delay","body":"Transport strike in Karachi delays SKU-1234 delivery (500 units) by 5 days. Original: 2026-05-15, New ETA: 2026-05-20."}',
          metadata: { timestamp: "2026-05-15T08:30:00Z", authority_type: "supplier_portal" },
        },
        {
          source_id: "SRC-004", source_type: "url",
          content: "Transport strike in Karachi enters day 3, disrupting supply chains. Logistics firms report 100% route blockage on main arterial roads. Multiple warehouses declare emergency shortage protocols.",
          metadata: { timestamp: "2026-05-15T07:00:00Z", authority_type: "news_feed" },
        },
        {
          source_id: "SRC-005", source_type: "json",
          content: '{"complaints":["Order #4521 not delivered, 3 days late","Out of stock notice received — no ETA","Competitor now stocking SKU-1234 at 15% premium"],"severity":"HIGH","count":47}',
          metadata: { timestamp: "2026-05-15T11:00:00Z", authority_type: "customer_feedback" },
        },
      ],
    },
  },
  {
    id: "supplier-default-risk",
    label: "Supplier Default Risk",
    icon: "⚠️",
    description: "Assess risk when a primary supplier shows financial distress signals.",
    request: {
      constraints: { budget_limit: { amount: 2000000, currency: "PKR" }, time_limit_hours: 48, urgency: "high" },
      sources: [
        {
          source_id: "SRC-001", source_type: "pdf",
          content: "SUPPLIER RISK ASSESSMENT — Alpha Components Ltd\nCredit Rating: Downgraded from BB to CCC\nOutstanding invoices: PKR 4.2M overdue >90 days\nDelivery performance last 60 days: 62% on-time (vs 94% target)\nCurrent open POs: 12 orders worth PKR 8.5M",
          metadata: { timestamp: "2026-05-14T09:00:00Z", authority_type: "official_report" },
        },
        {
          source_id: "SRC-002", source_type: "csv",
          content: "month,on_time_pct,defect_rate_pct,lead_time_days,cost_variance_pct\n2026-05,62,4.2,18,-8\n2026-04,71,3.1,15,-5\n2026-03,89,1.2,12,0\n2026-02,94,0.8,11,1",
          metadata: { timestamp: "2026-05-15T00:00:00Z", authority_type: "analytics_platform" },
        },
        {
          source_id: "SRC-003", source_type: "url",
          content: "Alpha Components Ltd under creditor pressure. Banking sources confirm working capital crunch. Two alternate suppliers — Beta Parts (lead time 14 days, +12% cost) and Gamma Supply (lead time 21 days, +5% cost) — available for immediate onboarding.",
          metadata: { timestamp: "2026-05-13T06:00:00Z", authority_type: "news_feed" },
        },
        {
          source_id: "SRC-004", source_type: "json",
          content: '{"alternate_suppliers":[{"name":"Beta Parts","lead_time_days":14,"cost_premium_pct":12,"capacity_units":5000,"certification":"ISO-9001"},{"name":"Gamma Supply","lead_time_days":21,"cost_premium_pct":5,"capacity_units":8000,"certification":"ISO-9001"}]}',
          metadata: { timestamp: "2026-05-15T08:00:00Z", authority_type: "supplier_portal" },
        },
        {
          source_id: "SRC-005", source_type: "json",
          content: '{"current_safety_stock":800,"reorder_point":1200,"avg_daily_demand":85,"open_orders_at_risk_units":4200,"impacted_production_lines":3}',
          metadata: { timestamp: "2026-05-15T10:00:00Z", authority_type: "internal_system" },
        },
      ],
    },
  },
  {
    id: "demand-surge",
    label: "Demand Surge Response",
    icon: "📈",
    description: "Sudden +340% demand spike requiring rapid procurement and capacity reallocation.",
    request: {
      constraints: { budget_limit: { amount: 1500000, currency: "PKR" }, time_limit_hours: 12, urgency: "critical" },
      sources: [
        {
          source_id: "SRC-001", source_type: "csv",
          content: "hour,orders_received,units_demanded,platform\n09:00,340,680,online\n10:00,520,1040,online\n11:00,490,980,retail\n12:00,610,1220,wholesale\n13:00,580,1160,online",
          metadata: { timestamp: "2026-05-15T13:00:00Z", authority_type: "analytics_platform" },
        },
        {
          source_id: "SRC-002", source_type: "json",
          content: '{"event":"Flash Sale Campaign Live","platform":"all channels","discount_pct":25,"campaign_duration_hours":24,"expected_uplift_pct":200,"actual_uplift_pct":340,"conversion_rate":0.18}',
          metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "internal_system" },
        },
        {
          source_id: "SRC-003", source_type: "pdf",
          content: "INVENTORY SNAPSHOT — 13:00 hrs\nSKU-2001 Available: 1,200 units\nForecast demand next 24h: 5,800 units\nGap: 4,600 units\nWarehouse B reserve: 800 units (2-day transfer)\nSupplier X emergency capacity: 3,000 units (6-hour lead time, +20% cost)",
          metadata: { timestamp: "2026-05-15T13:00:00Z", authority_type: "official_report" },
        },
        {
          source_id: "SRC-004", source_type: "url",
          content: "Social media trend: SKU-2001 viral on platform X. Influencer endorsement driving 50K impressions per hour. Competitor out of stock. Customer sentiment: 92% positive purchase intent.",
          metadata: { timestamp: "2026-05-15T11:00:00Z", authority_type: "news_feed" },
        },
        {
          source_id: "SRC-005", source_type: "json",
          content: '{"warehouse_b_transfer":{"units":800,"eta_hours":48,"cost_pkr":12000},"supplier_emergency_order":{"units":3000,"eta_hours":6,"cost_pkr":750000},"production_overtime":{"additional_units":1200,"eta_hours":18,"cost_pkr":280000}}',
          metadata: { timestamp: "2026-05-15T13:30:00Z", authority_type: "internal_system" },
        },
      ],
    },
  },
  {
    id: "multi-warehouse",
    label: "Multi-Warehouse Redistribution",
    icon: "🏭",
    description: "Optimise stock across 4 warehouse locations with varying capacity and demand.",
    request: {
      constraints: { budget_limit: { amount: 300000, currency: "PKR" }, time_limit_hours: 36, urgency: "medium" },
      sources: [
        {
          source_id: "SRC-001", source_type: "json",
          content: '{"warehouses":[{"id":"WH-A","location":"Karachi","stock_units":120,"capacity":2000,"utilization_pct":6},{"id":"WH-B","location":"Lahore","stock_units":1850,"capacity":2000,"utilization_pct":92},{"id":"WH-C","location":"Islamabad","stock_units":95,"capacity":1500,"utilization_pct":6},{"id":"WH-D","location":"Faisalabad","stock_units":430,"capacity":1000,"utilization_pct":43}]}',
          metadata: { timestamp: "2026-05-15T08:00:00Z", authority_type: "internal_system" },
        },
        {
          source_id: "SRC-002", source_type: "csv",
          content: "warehouse,daily_demand_units,reorder_point,days_of_stock,risk_level\nWH-A,85,500,1.4,CRITICAL\nWH-B,120,400,15.4,LOW\nWH-C,70,300,1.4,CRITICAL\nWH-D,95,200,4.5,HIGH",
          metadata: { timestamp: "2026-05-15T08:30:00Z", authority_type: "analytics_platform" },
        },
        {
          source_id: "SRC-003", source_type: "pdf",
          content: "INTER-BRANCH TRANSFER COST MATRIX\nKarachi→Lahore: PKR 45/unit, 3 days\nLahore→Karachi: PKR 45/unit, 3 days\nLahore→Islamabad: PKR 30/unit, 2 days\nLahore→Faisalabad: PKR 20/unit, 1 day\nFaisalabad→Karachi: PKR 55/unit, 4 days",
          metadata: { timestamp: "2026-05-15T00:00:00Z", authority_type: "official_report" },
        },
        {
          source_id: "SRC-004", source_type: "json",
          content: '{"pending_customer_orders":{"WH-A":340,"WH-C":280},"bulk_supplier_delivery":{"WH-B":2000,"eta":"2026-05-16","sku":"SKU-3300"},"transfer_approval_required_above_units":500}',
          metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "internal_system" },
        },
        {
          source_id: "SRC-005", source_type: "url",
          content: "Motorway M2 (Lahore-Islamabad) operating at full capacity with no disruptions. Karachi port clearance delays reduced to 24h. Freight rates stable this week — no surcharges expected.",
          metadata: { timestamp: "2026-05-15T06:00:00Z", authority_type: "news_feed" },
        },
      ],
    },
  },
  {
    id: "out-of-domain",
    label: "❌ Out-of-Domain Test",
    icon: "🚫",
    description: "Test domain rejection — sends non-supply-chain content to verify the agent refuses gracefully.",
    request: {
      constraints: DEFAULT_CONSTRAINTS,
      sources: [
        {
          source_id: "SRC-001", source_type: "url",
          content: "Pakistan cricket team won the Test series against England by 2 matches. Babar Azam scored a century in the final match. The selectors are happy with team performance.",
          metadata: { timestamp: "2026-05-15T09:00:00Z", authority_type: "news_feed" },
        },
        {
          source_id: "SRC-002", source_type: "json",
          content: '{"topic":"entertainment","movie":"New Bollywood Release","box_office_pkr":50000000,"rating":4.2,"genre":"action"}',
          metadata: { timestamp: "2026-05-15T10:00:00Z", authority_type: "news_feed" },
        },
        {
          source_id: "SRC-003", source_type: "pdf",
          content: "RECIPE: Chicken Biryani\nIngredients: 1kg chicken, 3 cups basmati rice, 2 onions, spices.\nMethod: Marinate chicken for 2 hours. Cook on low heat for 45 minutes.",
          metadata: { timestamp: "2026-05-15T11:00:00Z", authority_type: "news_feed" },
        },
      ],
    },
  },
];
