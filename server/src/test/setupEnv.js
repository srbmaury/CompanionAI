// Tests must be reproducible without a developer's untracked .env file.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "companionai-ci-test-jwt-secret-not-for-production";
process.env.STRIPE_SECRET_KEY ||= "sk_test_companionai_ci_only";
