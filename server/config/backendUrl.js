/**
 * ⭐ BACKEND URL CONFIGURATION ⭐
 * Single source of truth for backend URL
 * Change this when deploying to a new backend URL
 */

const getBackendUrl = () => {
    return process.env.BASE_URL;
};

module.exports = {
    getBackendUrl
};
