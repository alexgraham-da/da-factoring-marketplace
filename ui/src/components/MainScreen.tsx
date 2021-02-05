// Copyright (c) 2020 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import React, { PropsWithChildren, useEffect, useState } from "react";
import {
  Switch,
  Route,
  useRouteMatch,
  useHistory,
  Redirect,
} from "react-router-dom";
import { ToastProvider } from "react-toast-notifications";
import { useDablParties } from "./common/common";

import SellerInvoices from "./Seller/Invoices/Invoices";
import BuyerAuctions from "./Buyer/Auctions/Auctions";
import BidsView from "./common/Auctions/BidsView/BidsView";
import BrokerMyUsers from "./Broker/MyUsers/MyUsers";
import BrokerInvoices from "./Broker/Invoices/Invoices";
import {
  useParty,
  useQuery,
  useStreamQueries,
  useStreamQuery,
} from "@daml/react";
import { Seller } from "@daml.js/da-marketplace/lib/Factoring/Seller";
import { Buyer } from "@daml.js/da-marketplace/lib/Factoring/Buyer";
import { Exchange } from "@daml.js/da-marketplace/lib/Marketplace/Exchange";
import { FactoringRole } from "./common/FactoringRole";
import { Custodian } from "@daml.js/da-marketplace/lib/Marketplace/Custodian";
import CSDAuctions from "./CSD/Auctions/Auctions";
import ExchangeAllUsers from "./Exchange/AllUsers/AllUsers";
import BrokerSellers from "./Broker/Sellers/Sellers";
import BrokerBuyers from "./Broker/Buyers/Buyers";
import ExchangeDashboard from "./Exchange/Dashboard/Dashboard";
import CSDDashboard from "./CSD/Dashboard/Dashboard";
import OnboardUser from "./OnboardUser/OnboardUser";
import { RegisteredUser } from "@daml.js/da-marketplace/lib/Factoring/Registry";
import ProfilePage from "./common/ProfilePage/ProfilePage";
import { LogoutUser } from "./common/LogoutUser/LogoutUser";
import ExchangeAuctions from "./Exchange/Auctions/Auctions";

interface MainScreenProps {
  onLogout: () => void;
}

/**
 * React component for the main screen of the `App`.
 */

const MainScreen: React.FC<MainScreenProps> = (props) => {
  const { onLogout } = props;
  const history = useHistory();
  const { path } = useRouteMatch();
  const [role, setRole] = useState<FactoringRole>();
  const [user, setUser] = useState<RegisteredUser>();
  const [roleFetched, setRoleFetched] = useState(false);
  const party = useParty();

  const userContracts = useStreamQueries(RegisteredUser).contracts;

  const sellerContracts = useStreamQueries(Seller).contracts;

  const buyerContracts = useStreamQueries(Buyer).contracts;

  const exchangeContracts = useStreamQueries(Exchange).contracts;

  const custodianContracts = useStreamQueries(Custodian).contracts;

  console.log(path);
  useEffect(() => {
    const userPayload = userContracts[0]?.payload;
    if (userPayload) {
      setUser(userPayload);
    }
  }, [userContracts]);
  useEffect(() => {
    if (role !== undefined && !roleFetched) {
      history.push(`${path}/${role.toLowerCase()}`);
      if (role !== FactoringRole.Exchange && role !== FactoringRole.CSD) {
        setRoleFetched(true);
      }
    }
  }, [history, path, role, roleFetched]);

  useEffect(() => {
    if (custodianContracts.length > 0) {
      setRole(FactoringRole.CSD);
    } else if (party === "Broker") {
      setRole(FactoringRole.Broker);
    } else if (sellerContracts.length > 0) {
      setRole(FactoringRole.Seller);
    } else if (buyerContracts.length > 0) {
      setRole(FactoringRole.Buyer);
    } else if (exchangeContracts.length > 0) {
      setRole(FactoringRole.Exchange);
    }
  }, [
    sellerContracts,
    buyerContracts,
    exchangeContracts,
    custodianContracts,
    party,
  ]);
  const exchangeUser: Partial<RegisteredUser> = {
    firstName: "Exchange",
    roles: ["ExchangeRole"],
  };
  const csdUser: Partial<RegisteredUser> = {
    firstName: "CSD",
    roles: ["CSDRole"],
  };
  return (
    <ToastProvider>
      <Switch>
        <Route exact path={`${path}`}>
          <OnboardUser />
        </Route>
        <Route exact path={`/logout`}>
          <LogoutUser onLogout={onLogout} />
        </Route>
        <Route exact path={`${path}/profile`}>
          <ProfilePage user={user} />
        </Route>
        <Route exact path={`${path}/exchange/`}>
          <Redirect to={`${path}/exchange/dashboard`} />
        </Route>
        <Route path={`${path}/exchange/dashboard`}>
          <ExchangeDashboard user={exchangeUser} />
        </Route>
        <Route path={`${path}/exchange/users`}>
          <ExchangeAllUsers user={exchangeUser} />
        </Route>
        <Route exact path={`${path}/exchange/auctions`}>
          <ExchangeAuctions user={exchangeUser} />
        </Route>
        <Route path={`${path}/exchange/auctions/:auctionContractId`}>
          <BidsView
            user={exchangeUser}
            historicalView={true}
            userRole={FactoringRole.Exchange}
          />
        </Route>
        <Route exact path={`${path}/csd/`}>
          <Redirect to={`${path}/csd/dashboard`} />
        </Route>
        <Route path={`${path}/csd/dashboard`}>
          <CSDDashboard user={csdUser} />
        </Route>
        <Route exact path={`${path}/csd/auctions`}>
          <CSDAuctions user={csdUser} />
        </Route>
        <Route path={`${path}/csd/auctions/:auctionContractId`}>
          <BidsView
            user={csdUser}
            historicalView={true}
            userRole={FactoringRole.CSD}
          />
        </Route>
        <Route exact path={`${path}/seller`}>
          <Redirect to={`${path}/seller/invoices`} />
        </Route>
        <Route exact path={`${path}/seller/invoices`}>
          <SellerInvoices user={user} />
        </Route>
        <Route path={`${path}/seller/auctions/:auctionContractId`}>
          <BidsView
            user={user}
            userRole={FactoringRole.Seller}
            historicalView={true}
          />
        </Route>
        <Route exact path={`${path}/buyer/`}>
          <Redirect to={`${path}/buyer/auctions`} />
        </Route>
        <Route exact path={`${path}/buyer/auctions`}>
          <BuyerAuctions user={user} />
        </Route>
        <Route path={`${path}/buyer/auctions/:auctionContractId`}>
          <BidsView user={user} userRole={FactoringRole.Buyer} />
        </Route>
        <Route exact path={`${path}/broker/`}>
          <Redirect to={`${path}/broker/users`} />
        </Route>
        <Route path={`${path}/broker/users`}>
          <BrokerMyUsers />
        </Route>
        <Route path={`${path}/broker/invoices`}>
          <BrokerInvoices />
        </Route>
        <Route path={`${path}/broker/sellers`}>
          <BrokerSellers />
        </Route>
        <Route path={`${path}/broker/buyers`}>
          <BrokerBuyers />
        </Route>
      </Switch>
    </ToastProvider>
  );

  /*
    <Switch>
      <Route exact path={path}>
        { loading || !parties
          ? loadingScreen
          : error ? errorScreen : <RoleSelectScreen operator={parties.userAdminParty} onLogout={onLogout}/>
        }
      </Route>

      <Route path={`${path}/investor`}>
        <Investor onLogout={onLogout}/>
      </Route>

      <Route path={`${path}/issuer`}>
        <Issuer onLogout={onLogout}/>
      </Route>

      <Route path={`${path}/exchange`}>
        <Exchange onLogout={onLogout}/>
      </Route>

      <Route path={`${path}/custodian`}>
        <Custodian onLogout={onLogout}/>
      </Route>

      <Route path={`${path}/broker`}>
        <Broker onLogout={onLogout}/>
      </Route>
    </Switch>
    */
};

export default MainScreen;
