const Order = require("../models/Order");
const { withOrderTotals } = require("../utils/orderTotals");

const SALES_STATUSES = ["pending", "paid", "shipped", "delivered"];

const round2 = (value) => Number((Number(value) || 0).toFixed(2));

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const orderAmount = (order) =>
  Number(withOrderTotals(order).grand_total || order.totalPrice || 0);

const isSalesOrder = (order) => SALES_STATUSES.includes(order.status);

const inRange = (order, start, end) => {
  const time = new Date(order.createdAt).getTime();
  return time >= start.getTime() && time < end.getTime();
};

const breakdown = (orders) => {
  const sales = orders.filter(isSalesOrder);
  const cash = sales.filter((order) => order.paymentMethod === "cod");
  const card = sales.filter((order) => order.paymentMethod === "card");
  return {
    total: round2(sales.reduce((sum, order) => sum + orderAmount(order), 0)),
    count: sales.length,
    cash: round2(cash.reduce((sum, order) => sum + orderAmount(order), 0)),
    card: round2(card.reduce((sum, order) => sum + orderAmount(order), 0)),
    credit: 0,
  };
};

const getDashboard = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 50);

    const orders = await Order.find()
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });
    const mapped = orders.map(withOrderTotals);

    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayOrders = mapped.filter((order) => inRange(order, todayStart, tomorrow));
    const yesterdayOrders = mapped.filter((order) => inRange(order, yesterdayStart, todayStart));
    const thisMonthOrders = mapped.filter((order) => inRange(order, thisMonthStart, nextMonthStart));
    const lastMonthOrders = mapped.filter((order) => inRange(order, lastMonthStart, thisMonthStart));

    const weeklySales = [];
    for (let index = 6; index >= 0; index -= 1) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - index);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayOrders = mapped.filter((order) => inRange(order, dayStart, dayEnd));
      const sales = breakdown(dayOrders);
      weeklySales.push({
        date: dayStart.toISOString().slice(0, 10),
        sales: sales.total,
        orders: dayOrders.length,
      });
    }

    const productMap = new Map();
    mapped.filter(isSalesOrder).forEach((order) => {
      (order.items || []).forEach((item) => {
        const name = item.name || "Product";
        const current = productMap.get(name) || { name, quantity: 0, revenue: 0 };
        current.quantity += Number(item.quantity || 0);
        current.revenue += Number(item.price || 0) * Number(item.quantity || 0);
        productMap.set(name, current);
      });
    });
    const bestSelling = [...productMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6)
      .map((item) => ({ ...item, revenue: round2(item.revenue) }));

    const pendingAmount = round2(
      mapped
        .filter((order) => order.status === "pending")
        .reduce((sum, order) => sum + orderAmount(order), 0)
    );

    const recentTotal = mapped.length;
    const pages = Math.ceil(recentTotal / limit) || 1;
    const recentOrders = mapped.slice((page - 1) * limit, page * limit).map((order) => ({
      _id: order._id,
      invoiceNo: String(order._id).slice(-8).toUpperCase(),
      createdAt: order.createdAt,
      customerName: order.user?.name || order.customerName || "Customer",
      customerEmail: order.user?.email || order.customerEmail || "",
      paymentMethod: order.paymentMethod || "cod",
      amount: round2(orderAmount(order)),
      status: order.status,
    }));

    res.json({
      sales: {
        today: breakdown(todayOrders),
        yesterday: breakdown(yesterdayOrders),
        thisMonth: breakdown(thisMonthOrders),
        lastMonth: breakdown(lastMonthOrders),
        allTime: breakdown(mapped),
      },
      counts: {
        total: mapped.length,
        pending: mapped.filter((order) => order.status === "pending").length,
        pendingAmount,
        processing: mapped.filter((order) => order.status === "paid" || order.status === "shipped").length,
        delivered: mapped.filter((order) => order.status === "delivered").length,
      },
      weeklySales,
      bestSelling,
      recentOrders,
      page,
      pages,
      total: recentTotal,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
