const validateCity = (deliveryCity, restaurantCity) => {
    return deliveryCity.trim().toLowerCase() === restaurantCity.trim().toLowerCase();
};

module.exports = validateCity;
