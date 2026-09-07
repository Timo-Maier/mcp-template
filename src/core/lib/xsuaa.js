'use strict';

const passport = require('passport');
const { XssecPassportStrategy, XsuaaService } = require('@sap/xssec');
const xsenv = require('@sap/xsenv');

function setupAuth(app) {
  const xsuaa = xsenv.getServices({ xsuaa: { tag: 'xsuaa' } }).xsuaa;
  const authService = new XsuaaService(xsuaa);
  passport.use(new XssecPassportStrategy(authService));

  app.use(passport.initialize());

  app.use((req, res, next) => {
    passport.authenticate('JWT', { session: false, failWithError: true })(req, res, next);
  });
}

module.exports = { setupAuth };
