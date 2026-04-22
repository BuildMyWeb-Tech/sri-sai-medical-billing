/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        unoptimized: true
    },

    async redirects() {
        return [
            {
                source: "/",
                destination: "/store",
                permanent: false,
            },
            {
                source: "/employee",
                destination: "/employee/login",
                permanent: false,
            },
        ];
    },
};

export default nextConfig;