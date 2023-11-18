---
layout: post
title: I Love Rspec
description: 
date: 2023-11-18
image: assets/images/IMG_3278.jpg
permalink: /posts/2023/i-love-rspec.html
categories: [coding]
tags: [Code, Testing, RSpec, Ruby]
published: true
---
As all of you know, I 🩷 Ruby. Some day, I’ll talk about my journey learning different programming languages until I found the best one for me. However, today, I want to talk about one of the best tools I’ve used: [RSpec](https://rspec.info/).

RSpec allows behavior-driven development for Ruby. Compared to other BDD tools like MOCHA, it does not seem special at first glance, but it really adds superpowers (even more if used with Rails). Let’s look at a simple example of creating an enumeration inside our model. Rails will automatically provide us with some utility methods.

{% highlight ruby %}
class IncomingPayment < BaseModel
  enum status: {
    created: 0,
    confirmed: 1,
    rejected: 2,
    expected: 3
  }
}

# So we can use these methods
incoming_payment.created?
incoming_payment.created!
{% endhighlight %}

RSpec provides tons of utilities to make our tests more natural. For example, we can test all boolean values in this natural way:
```rb
describe "status" do
  it "is optional" do
    incoming_payment = build(:incoming_payment, status: nil)

    # because there is a #valid? method, we can do:
    expect(incoming_payment).to be_valid
  end
end
```

RSpec also allows the creation of tests dynamically. Imagine we want to test the model can be moved to rejected status only if the current status is created. We could add the different scenarios explicitly:
```rb
describe "set status as rejected" do
  context "with a created incoming payment" do
    it "is allowed" do
      incoming_payment = build(:incoming_payment, :created)

      incoming_payment.rejected!

      expect(incoming_payment).to be_rejected
    end
  end

  context "with a confirmed incoming payment" do
    it "is allowed" do
      incoming_payment = build(:incoming_payment, :confirmed)

      incoming_payment.rejected!

      expect(incoming_payment).not_to be_rejected
    end
  end
end
```

Or, if we have many statuses, we can create tests dynamically and be sure everything is well tested when we add a new status.
```rb
describe "set status as rejected" do
  %w[created rejected].tap do |rejectable_statuses|
    rejectable_statuses.each do |status|
      context "with a #{status} incoming payment" do
        it "is allowed" do
          incoming_payment = build(:incoming_payment, status)

          incoming_payment.rejected!

          expect(incoming_payment).to be_rejected
        end
      end
    end

    (IncomingPayment.statuses.keys - rejectable_statuses).each do |status|
      context "with a #{status} incoming payment" do
        it "is disallowed" do
          incoming_payment = build(:incoming_payment, status)

          incoming_payment.rejected!

          expect(incoming_payment).not_to be_rejected
        end
      end
    end
  end
end
```

Et voilà! This is the output we see running this spec.

![Captura de pantalla 2023-11-15 a las 12 58 04](https://github.com/IvanGuardado/ivanguardado.github.io/assets/767493/bd4d0f83-4281-4014-9d9c-6c17bb3d2c8b)

Another interesting feature I hadn’t seen in other testing tools is the memoize helper “let()”. It’s a kind of lazy variable that allows us to configure our tests better.

```rb
describe "amount_validation" do
  let(:incoming_payment, amount: amount)

  context "with a positive amount" do
    let(:amount) { 100 }

    it "is valid" do
      expect(incoming_payment).to be_valid
    end
  end

  context "with a negative amount" do
    let(:amount) { -10 }

    it "is not valid" do
      expect(incoming_payment).not_to be_valid
    end
  end
end
```

Last but not least, it’s very straightforward to spy and mock objects. This is, again, thanks to the Ruby's versatility. For example, if we want to force an error when a method is called:
```rb
describe "confirm a payment" do
  context "when the payment cannot be rejected" do
    it "raises an error" do
      allow(payment).to receive(:reject!).and_raise_error MyCustomError

      expect { payment_confirmer.invoke(payment) }.to raise_error MyCustomError
    end
  end
end
```

There are many other cool things I don't want to publish now. These are just the basics. However, I'll keep updating this blog with interesting scenarios we have in the [@devengoapi](https://twitter.com/devengoapi) codebase. 

Have a good testing!
