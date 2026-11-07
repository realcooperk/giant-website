// Update these two values to match your bot's current reach.
const giantStats = {
  servers: 10,
  users: 1500,
};

const numberFormatter = new Intl.NumberFormat("en-US");

document.getElementById("server-count").textContent =
  `${numberFormatter.format(giantStats.servers)}+`;
document.getElementById("user-count").textContent =
  `${numberFormatter.format(giantStats.users)}+`;
