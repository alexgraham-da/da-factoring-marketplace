
import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { Form, Button, List } from "semantic-ui-react";
import { Party } from '@daml/types';
import Ledger from "@daml/ledger";
import { PartyDetails, retrieveParties } from "./Parties"
import { FactoringOperator, SellerInvitation, BuyerInvitation } from "@daml.js/daml-factoring/lib/Factoring/Onboarding";
import { wrapDamlTuple } from "./common/damlTypes";
import { Buyer } from "@daml.js/daml-factoring/lib/Factoring/Buyer";
import { BrokerInvitation } from "@daml.js/daml-factoring/lib/Marketplace/Broker";
import { OnboardingTile } from './LoginScreen'

import './CreateMarket.css'

export type PartyLogin = {
    party: Party;
    token: string;
}

export type LedgerProps = {
    httpBaseUrl?: string;
    wsBaseUrl?: string;
    reconnectThreshold?: number;
}

const CreateMarket: React.FC<LedgerProps> = ({ httpBaseUrl, wsBaseUrl, reconnectThreshold }) => {
  const parties = retrieveParties();
  const [didBootstrap, setDidBootstrap] = useState<boolean>(false);
  const [logItems, setLogItems] = useState<Array<string>>([]);
  const loginMap = new Map<string,PartyDetails>(parties.map(obj => [obj.partyName, obj]));
  const sellers = parties.filter(p => { return p.partyName.includes("Seller") });
  const buyers = parties.filter(p => { return p.partyName.includes("Buyer") });
  const brokers = parties.filter(p => { return p.partyName.includes("Broker") });
  const history = useHistory();


  const addToLog = (toAdd: string) => {
      setLogItems(logItems => logItems.concat(toAdd));
  }


  const handleSetup = async (event: React.FormEvent) => {
      if (loginMap !== undefined) {
        const userAdmin = loginMap.get('UserAdmin');
        const exchange = loginMap.get('Exchange');
        const csd = loginMap.get('CSD');
        const adminLedger = new Ledger({token: userAdmin.token, httpBaseUrl, wsBaseUrl, reconnectThreshold})

        addToLog("Onboarding operator...");
        try {
          await adminLedger.create(FactoringOperator, {operator: userAdmin.party, public: loginMap.get('Public').party, csd: csd.party, exchange: exchange.party});
        } catch(e) {
          console.log("error exercising setup: " + e);
        }

        addToLog("onboarding parties...");
        const setupMarketArgs = {
          csd: csd.party,
          exchange: exchange.party,
          sellers: sellers.map(s => {return s.party}),
          buyers: buyers.map(b => {return b.party}),
          brokers: brokers.map(b => {return b.party})
        }
        try {
          await adminLedger.exerciseByKey(FactoringOperator.FactoringOperator_SetupMarket, userAdmin.party, setupMarketArgs);
        } catch(e) {
          console.log("error exercising setup: " + e);
        }

        addToLog("accepting seller invitations...");
        for (const seller of sellers) {
          addToLog("adding seller: " + seller.partyName);
          const ledger = new Ledger({token: seller.token, httpBaseUrl, wsBaseUrl, reconnectThreshold})
          const args = { firstName: seller.partyName, lastName: "Seller", company: "here", email: "seller@seller.com", isPublic: true }
          try {
            await ledger.exerciseByKey(SellerInvitation.SellerInvitation_Accept, wrapDamlTuple([userAdmin.party, seller.party]), args);
          } catch(e) {
            console.log('error exercising seller' + e);
          }
        };

        addToLog("accepting buyer invitations...");
        for (const buyer of buyers) {
          addToLog("adding buyer: " + buyer.partyName);
          const ledger = new Ledger({token: buyer.token, httpBaseUrl, wsBaseUrl, reconnectThreshold})
          const args = { firstName: buyer.partyName, lastName: "Buyer", company: "company", email: "email", isPublic: true }
          try {
            await ledger.exerciseByKey(BuyerInvitation.BuyerInvitation_Accept, wrapDamlTuple([userAdmin.party, buyer.party]), args);
          } catch(e) {
            console.log('error acepting buyer ' + e);
          }
          try {
            await ledger.exerciseByKey(Buyer.Buyer_RequestDeposit, wrapDamlTuple([userAdmin.party, buyer.party]), { amount: "10000000.0" });
          } catch(e) {
            console.log('error requesting deposit ' + e);
          }
        }

        addToLog("accepting broker invitations...");
        for (const broker of brokers) {
          const ledger = new Ledger({token: broker.token, httpBaseUrl, wsBaseUrl, reconnectThreshold})
          const args = { name: broker.partyName, location: "", isPublic: true }
          await ledger.exerciseByKey(BrokerInvitation.BrokerInvitation_Accept, wrapDamlTuple([userAdmin.party, broker.party]), args);
        }

        addToLog("done!");
        setDidBootstrap(true);
      }
  };

  return (
    <OnboardingTile subtitle='Create sample market'>
      <Form size="large" className="test-select-login-screen">
        { !didBootstrap ? (
          <Button
            primary
            fluid
            className="test-select-login-button"
            content="Go!"
            onClick={handleSetup}
          />
        ) : (
          <Button
            primary
            fluid
            className="test-select-login-butt"
            content="Return to login"
            onClick={() => history.push("/login")}/>
        )}
      </Form>
      <List items={logItems}/>
    </OnboardingTile>
  );
};

export default CreateMarket;
